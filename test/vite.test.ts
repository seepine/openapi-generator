/**
 * Unit tests for the Vite plugin (`src/vite.ts`).
 *
 * The plugin is exercised by hand-rolling a `Plugin` instance via the factory
 * and invoking the lifecycle hooks (`configResolved`, `buildStart`,
 * `watchChange`) directly. `generate()` is mocked so we can:
 *   - assert how many times it is invoked,
 *   - deterministically advance `Date.now()` via `vi.useFakeTimers()` to
 *     verify the `watchDebounce` window.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { openapiGenerator, toForwardSlash } from '../src/vite'
import * as generateModule from '../src/generate'
import type { GeneratorConfig } from '../src/generate'

type Hook = (this: unknown, ...args: unknown[]) => unknown | Promise<unknown>

function getHook(
  plugin: ReturnType<typeof openapiGenerator>,
  name: string,
): Hook {
  // Vite plugin lifecycle hooks are functions stored directly on the plugin
  // object. We cast through `unknown` to keep this helper free of `any`.
  const hook = (plugin as unknown as Record<string, unknown>)[name]
  if (typeof hook !== 'function') {
    throw new Error(`plugin has no hook: ${name}`)
  }
  return hook as Hook
}

/**
 * Run `configResolved` + `buildStart` against the plugin, then advance the
 * fake clock by `extraMs` so that a subsequent `watchChange` for the
 * same input is guaranteed to land outside the debounce window. Returns
 * a function that fires `watchChange` with the input file.
 *
 * `buildStart` itself stamps `lastRunAt = Date.now()`, so the test must
 * "wait out" the window before exercising the watch path.
 */
async function boot(
  plugin: ReturnType<typeof openapiGenerator>,
  inputFile: string,
  tmpRoot: string,
  extraMs: number,
): Promise<() => Promise<void>> {
  return bootWithCommand(plugin, inputFile, tmpRoot, extraMs, 'serve')
}

/**
 * Like {@link boot} but lets the test pin the Vite `command` field that
 * `configResolved` receives. Defaults to `serve` (the dev mode the
 * plugin targets by default); pass `'build'` to exercise the
 * `runOnBuild` opt-in path.
 */
async function bootWithCommand(
  plugin: ReturnType<typeof openapiGenerator>,
  inputFile: string,
  tmpRoot: string,
  extraMs: number,
  command: 'serve' | 'build',
): Promise<() => Promise<void>> {
  await getHook(plugin, 'configResolved').call(
    {},
    // Only the fields the plugin reads are populated; the real Vite
    // ResolvedConfig is much larger.
    { root: tmpRoot, command },
  )
  await getHook(plugin, 'buildStart').call({})
  const baseTime = vi.getMockedSystemTime()?.getTime() ?? Date.now()
  vi.setSystemTime(baseTime + extraMs)
  return async () => {
    await getHook(plugin, 'watchChange').call({}, inputFile)
  }
}

describe('openapiGenerator (vite plugin)', () => {
  let tmpRoot: string
  let inputFile: string
  let outputDir: string
  let generateSpy: MockInstance<(options: GeneratorConfig) => Promise<void>>

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'openapi-gen-vite-'))
    inputFile = join(tmpRoot, 'openapi.json')
    outputDir = join(tmpRoot, 'output')
    await mkdir(outputDir, { recursive: true })
    await writeFile(
      inputFile,
      JSON.stringify({ openapi: '3.0.0', paths: {} }),
      'utf-8',
    )

    // The plugin's `watchChange` is what we are testing, so we mock the
    // `generate()` entry point. The mock resolves immediately so we can
    // assert on call count after each `await` boundary.
    generateSpy = vi.spyOn(generateModule, 'generate').mockResolvedValue()
  })

  afterEach(async () => {
    generateSpy.mockRestore()
    vi.useRealTimers()
    await rm(tmpRoot, { recursive: true, force: true })
  })

  it('configResolved resolves relative outputDir against viteRoot', async () => {
    const plugin = openapiGenerator({ input: inputFile, outputDir: 'src/api' })
    // `this` in Vite hooks is the plugin context, but configResolved only
    // reads `config.root`, so a plain object is enough.
    await getHook(plugin, 'configResolved').call({}, { root: tmpRoot })
    // Trigger buildStart so we can observe the resolved outputDir.
    await getHook(plugin, 'buildStart').call({})
    expect(generateSpy).toHaveBeenCalledTimes(1)
    const firstCall = generateSpy.mock.calls[0]?.[0] as
      GeneratorConfig | undefined
    expect(firstCall?.outputDir).toBe(resolve(tmpRoot, 'src/api'))
  })

  describe('watchChange debounce', () => {
    it('changes to other files are ignored even when within the debounce window', async () => {
      vi.useFakeTimers()
      const t0 = new Date('2026-06-28T00:00:00Z')
      vi.setSystemTime(t0)

      const plugin = openapiGenerator({ input: inputFile })
      await getHook(plugin, 'configResolved').call({}, { root: tmpRoot })
      await getHook(plugin, 'buildStart').call({})

      // An unrelated file should never trigger generation, regardless
      // of the debounce window.
      const otherFile = join(tmpRoot, 'unrelated.json')
      await writeFile(otherFile, '{}', 'utf-8')
      await getHook(plugin, 'watchChange').call({}, otherFile)
      expect(generateSpy).toHaveBeenCalledTimes(1) // only buildStart
    })

    it('watch: false short-circuits watchChange', async () => {
      const plugin = openapiGenerator({ input: inputFile, watch: false })
      await getHook(plugin, 'configResolved').call({}, { root: tmpRoot })
      await getHook(plugin, 'buildStart').call({})
      // Even with the input file changing, nothing else fires.
      await getHook(plugin, 'watchChange').call({}, inputFile)
      expect(generateSpy).toHaveBeenCalledTimes(1) // only buildStart
    })
  })

  /**
   * URL input mode: when `input` is a URL, the plugin fetches the
   * document body in `buildStart` to prime a content cache, then in
   * every `watchChange` it re-fetches and skips `runGenerate` if the
   * bytes are unchanged. This protects against spurious regenerations
   * when the upstream URL is touched but its body has not actually
   * changed.
   *
   * The fetch call is stubbed at the `globalThis.fetch` level so we
   * can return canned responses and inspect how many times the
   * plugin polls the network.
   */
  describe('URL content cache', () => {
    let originalFetch: typeof globalThis.fetch
    let fetchSpy: MockInstance<(input: string) => Promise<ResponseLike>>

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
      fetchSpy?.mockRestore()
    })

    function makeResponse(body: string, ok = true): ResponseLike {
      return {
        ok,
        status: ok ? 200 : 500,
        statusText: ok ? 'OK' : 'Internal Server Error',
        text: () => Promise.resolve(body),
      }
    }

    // Install a structural mock for `globalThis.fetch`. We can't go
    // through `vi.spyOn(globalThis, 'fetch')` directly because its
    // type is the DOM `Response` (which has dozens of fields this
    // code path never touches); the plugin only consumes a structural
    // subset (`ok / status / statusText / text`).
    function installFetchMock(
      impl: (input: string) => Promise<ResponseLike>,
    ): MockInstance<(input: string) => Promise<ResponseLike>> {
      const spy = vi.fn(impl)
      globalThis.fetch = spy as unknown as typeof globalThis.fetch
      return spy
    }

    it('watchChange runs generate and updates the cache when the URL body changes', async () => {
      vi.useFakeTimers()
      const t0 = new Date('2026-06-28T00:00:00Z')
      vi.setSystemTime(t0)

      const url = 'http://example.com/openapi.json'
      const bodyV1 = JSON.stringify({ openapi: '3.0.0', paths: {} })
      const bodyV2 = JSON.stringify({ openapi: '3.0.0', paths: { '/v2': {} } })
      // buildStart returns v1; subsequent fetches return v2.
      let callIndex = 0
      fetchSpy = installFetchMock(async () => {
        callIndex++
        return makeResponse(callIndex === 1 ? bodyV1 : bodyV2)
      })

      const plugin = openapiGenerator({ input: url, watchDebounce: 1 })
      await getHook(plugin, 'configResolved').call({}, { root: tmpRoot })
      await getHook(plugin, 'buildStart').call({})
      expect(generateSpy).toHaveBeenCalledTimes(1)

      // First watchChange: body changes → cache updates + generate runs.
      vi.setSystemTime(t0.getTime() + 2_000)
      await getHook(plugin, 'watchChange').call({}, url)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(generateSpy).toHaveBeenCalledTimes(2)

      // Second watchChange: body unchanged again → skip generate.
      vi.setSystemTime(t0.getTime() + 4_000)
      await getHook(plugin, 'watchChange').call({}, url)
      expect(fetchSpy).toHaveBeenCalledTimes(3)
      expect(generateSpy).toHaveBeenCalledTimes(2)
    })

    it('a fetch failure during the cache check still runs generate()', async () => {
      vi.useFakeTimers()
      const t0 = new Date('2026-06-28T00:00:00Z')
      vi.setSystemTime(t0)

      const url = 'http://example.com/openapi.json'
      const body = JSON.stringify({ openapi: '3.0.0', paths: {} })
      // buildStart succeeds; the next fetch (in watchChange) fails.
      fetchSpy = installFetchMock(async () => {
        if (fetchSpy.mock.calls.length === 1) {
          return makeResponse(body)
        }
        return makeResponse('', false)
      })

      const plugin = openapiGenerator({ input: url, watchDebounce: 1 })
      await getHook(plugin, 'configResolved').call({}, { root: tmpRoot })
      await getHook(plugin, 'buildStart').call({})
      expect(generateSpy).toHaveBeenCalledTimes(1)

      // watchChange: the cache check fetch fails → fall through to
      // runGenerate so the underlying error surfaces via readDocument.
      vi.setSystemTime(t0.getTime() + 2_000)
      // The generate() mock resolves, so we don't need to assert the
      // error message here — just that generate() was called despite
      // the cache compare failing.
      await getHook(plugin, 'watchChange').call({}, url)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(generateSpy).toHaveBeenCalledTimes(2)
    })

    it('build skip also suppresses the URL cache-priming fetch', async () => {
      // URL input: if we skip build entirely, we must not even fetch
      // the upstream document during the build — a CI build with no
      // network access would otherwise fail needlessly.
      const url = 'http://example.com/openapi.json'
      fetchSpy = installFetchMock(async () =>
        makeResponse(JSON.stringify({ openapi: '3.0.0', paths: {} })),
      )
      const plugin = openapiGenerator({ input: url })
      await bootWithCommand(plugin, url, tmpRoot, 0, 'build')
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(generateSpy).not.toHaveBeenCalled()
    })
  })

  /**
   * `vite build` opt-in.
   *
   * The plugin's contract is "regenerate on dev"; `vite build` should
   * consume the already-generated `src/api` directory. To keep the
   * default safe, `buildStart` is a no-op during `build` unless
   * `runOnBuild: true` is passed. These tests pin `config.command`
   * to exercise the gate and the opt-in.
   */
  describe('runOnBuild gate', () => {
    it('buildStart is a no-op during vite build by default', async () => {
      const plugin = openapiGenerator({ input: inputFile })
      await bootWithCommand(plugin, inputFile, tmpRoot, 0, 'build')
      // No generate, no fetch, no nothing — `build` skips the plugin.
      expect(generateSpy).not.toHaveBeenCalled()
    })

    it('runOnBuild: true opts back in to generation during vite build', async () => {
      const plugin = openapiGenerator({
        input: inputFile,
        runOnBuild: true,
      })
      await bootWithCommand(plugin, inputFile, tmpRoot, 0, 'build')
      expect(generateSpy).toHaveBeenCalledTimes(1)
    })

    it('serve (dev) still runs even when runOnBuild is false (the default)', async () => {
      // The default value of `runOnBuild` must not affect `serve`.
      const plugin = openapiGenerator({ input: inputFile })
      await bootWithCommand(plugin, inputFile, tmpRoot, 0, 'serve')
      expect(generateSpy).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * Windows path separator handling.
   *
   * On Windows, `node:path.resolve` returns backslashes while Vite hands
   * `watchChange` a POSIX-style path (e.g. `C:/x/y.json`). A raw byte
   * compare would silently drop every dev-mode regeneration, so both
   * sides of the equality check go through `toForwardSlash` before the
   * comparison. The pure-function cases verify the helper; the
   * end-to-end plugin behaviour is covered by manual Windows testing
   * (mocking `node:path` is impractical here because Node's built-in
   * module exports are read-only and `vi.mock('node:path', ...)` would
   * leak into every other test in the file).
   */
  describe('Windows path separator handling', () => {
    it('toForwardSlash replaces backslashes with forward slashes', () => {
      expect(toForwardSlash('C:\\foo\\bar.json')).toBe('C:/foo/bar.json')
    })

    it('toForwardSlash leaves forward-slash paths unchanged', () => {
      expect(toForwardSlash('C:/foo/bar.json')).toBe('C:/foo/bar.json')
      expect(toForwardSlash('/abs/path.json')).toBe('/abs/path.json')
    })

    it('toForwardSlash handles a mix of separators', () => {
      expect(toForwardSlash('C:\\foo/bar\\baz.json')).toBe(
        'C:/foo/bar/baz.json',
      )
    })
  })
})

interface ResponseLike {
  ok: boolean
  status: number
  statusText: string
  text(): Promise<string>
}
