import { join, resolve, isAbsolute } from 'node:path'
import type { Plugin } from 'vite'
import { generate, type GeneratorConfig } from './generate'
import { fetchAsText } from './loader/readDocument'

/** Local mirror of loader/readDocument.isUrl — keeps URL inputs untouched. */
const isUrl = (s: string): boolean => /^https?:\/\//i.test(s)

/**
 * Options accepted by the Vite plugin.
 *
 * Mirrors {@link GeneratorConfig}, except `outputDir` is optional.
 *
 * `outputDir` resolution order (evaluated at `configResolved`):
 *   1. `undefined` → `<viteRoot>/src/api`
 *   2. absolute path (starts with `/` on POSIX, drive-letter on Windows) → used as-is
 *   3. relative path → resolved against `viteRoot`
 *
 * The same logic applies to `input` for consistency.
 */
export interface OpenapiGeneratorOptions extends Omit<
  GeneratorConfig,
  'outputDir'
> {
  /**
   * Output directory. Absolute paths are used as-is; relative paths are
   * resolved against `viteRoot`. Omit to default to `<viteRoot>/src/api`.
   */
  outputDir?: string
  /**
   * Re-run generation when the input file changes during `vite dev`.
   *
   * - `true` — watch the input file and regenerate on change. Uses `chokidar`
   *   loaded lazily so projects that never enable watching pay nothing.
   * - `false` — generate once on `buildStart` only.
   *
   * @default true
   */
  watch?: boolean
  /**
   * Debounce window (in seconds) for `watch` re-runs.
   *
   * After a `watchChange` triggers a regenerate, any subsequent
   * `watchChange` events for the same input within this window are
   * ignored. Once the window elapses, the next change is allowed to
   * trigger again. This avoids re-generating on a burst of editor
   * writes (e.g. `format on save` + duplicate FS events from
   * save-temp / atomic rename sequences).
   *
   * Unit: **seconds**.
   *
   * @default 30
   */
  watchDebounce?: number
}

/**
 * Vite plugin factory that runs {@link generate} before the bundle starts.
 *
 * The function is named `openapiGenerator` (camelCase) and returns a Vite
 * plugin instance.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite'
 * import { openapiGenerator } from '@seepine/openapi-generator/vite'
 *
 * export default defineConfig({
 *   plugins: [
 *     openapiGenerator({
 *       input: 'http://localhost:3000/openapi/json',
 *       // outputDir: '<root>/src/api'
 *       // outputDir: '/abs/path/api'  // absolute path, used as-is
 *       // outputDir: 'src/api'        // resolved against viteRoot
 *
 *       // globalName: 'Apis'
 *     }),
 *   ],
 * })
 * ```
 */
export function openapiGenerator(opts: OpenapiGeneratorOptions): Plugin {
  const { watch = true, watchDebounce = 30 } = opts
  // `lastRunAt` is the timestamp (Date.now(), ms) of the last successful
  // `runGenerate` invocation triggered by `watchChange`. `null` means
  // nothing has been triggered yet. The wall-clock value is reset only
  // after the actual generation completes, so a long-running regenerate
  // does not shorten the next window.
  let lastRunAt: number | null = null
  let outputDir: string | undefined
  let inputAbs: string | undefined
  // For URL inputs we cache the last-fetched document body so that a
  // `watchChange` event whose underlying fetch returns identical bytes
  // can short-circuit the regenerate. `null` means we have not fetched
  // yet (the initial fetch happens in `buildStart`).
  let lastUrlContent: string | null = null

  return {
    name: 'openapi-generator',
    async configResolved(config) {
      outputDir = resolveOutputDir(config.root, opts.outputDir)
      inputAbs = resolveInput(config.root, opts.input)
    },
    async buildStart() {
      // For URL inputs, prime the content cache so the very first
      // `watchChange` after startup can compare against it. The fetch
      // happens unconditionally — even if the cache compare later
      // determines the bytes are unchanged, we always want to populate
      // it once so the equality check has something to compare against.
      if (isUrl(inputAbs!)) {
        lastUrlContent = await fetchAsText(inputAbs!)
      }
      await runGenerate(outputDir!, inputAbs!, opts)
      lastRunAt = Date.now()
      // The `buildStart` run is the initial generation; it does not
      // consume the watch debounce window. We deliberately leave
      // `lastRunAt` as `null` so the very first `watchChange` after
      // startup is always allowed through.
    },
    async watchChange(id) {
      if (!watch) return
      // For URL inputs Vite will pass the URL string unchanged; for
      // file inputs it passes an absolute path. Comparing the raw
      // string would let a same-named sibling file slip through, so
      // we normalise file inputs via `path.resolve` while leaving
      // URLs alone (their `:` would otherwise become an OS path
      // separator and break equality).
      const normalisedId = isUrl(id) ? id : resolve(id)
      if (normalisedId !== inputAbs) return
      const now = Date.now()
      if (lastRunAt !== null && now - lastRunAt < watchDebounce * 1000) {
        return
      }
      // For URL inputs, fetch once and compare against the cached body.
      // If the bytes are identical we skip `runGenerate` entirely —
      // writing 4 files just to overwrite them with bit-for-bit equal
      // content is wasted I/O and risks spurious HMR invalidations.
      // A failed fetch is treated as "content may have changed" so
      // `runGenerate` still runs (and surfaces the network error
      // through `readDocument` rather than silently swallowing it).
      if (isUrl(inputAbs!)) {
        let fresh: string | null = null
        try {
          fresh = await fetchAsText(inputAbs!)
        } catch {
          await runGenerate(outputDir!, inputAbs!, opts)
          lastRunAt = Date.now()
          return
        }
        if (fresh === lastUrlContent) return
        lastUrlContent = fresh
      }
      await runGenerate(outputDir!, inputAbs!, opts)
      lastRunAt = Date.now()
    },
  }
}

function resolveOutputDir(root: string, outputDir: string | undefined): string {
  if (!outputDir) return join(root, 'src', 'api')
  if (isAbsolute(outputDir)) return outputDir
  return resolve(root, outputDir)
}

function resolveInput(root: string, input: string): string {
  if (isUrl(input)) return input
  if (isAbsolute(input)) return input
  return resolve(root, input)
}

async function runGenerate(
  outputDir: string,
  input: string,
  opts: OpenapiGeneratorOptions,
): Promise<void> {
  await generate({
    input,
    outputDir,
    ...(opts.globalName ? { globalName: opts.globalName } : {}),
  })
}
