import { join, resolve, isAbsolute } from 'node:path'
import type { Plugin } from 'vite'
import { generate, type GeneratorConfig } from './generate'
import { fetchAsText } from './loader/readDocument'
import { isUrl } from './utils/is'
import { warn } from './utils/logger'

/**
 * Options accepted by the Vite plugin.
 *
 * `outputDir` resolution order (evaluated at `configResolved`):
 *   1. `undefined` → `<viteRoot>/src/api`
 *   2. absolute path → used as-is
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
   * `chokidar` is loaded lazily so projects that never enable watching
   * pay nothing.
   * @default true
   */
  watch?: boolean
  /**
   * Debounce window (in seconds) for `watch` re-runs. Suppresses the burst
   * of editor writes around `format on save` (save-temp / atomic rename
   * sequences can emit multiple FS events for one logical change).
   * @default 30
   */
  watchDebounce?: number
  /**
   * Run generation during `vite build`. Off by default — production
   * builds typically consume the already-generated `src/api` directory
   * produced by `vite dev` (or by a pre-build script), and skipping
   * generation avoids redundant network/IO during CI builds.
   * @default false
   */
  runOnBuild?: boolean
}

/**
 * Vite plugin factory that runs {@link generate} before the bundle starts.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'vite'
 * import { openapiGenerator } from '@seepine/openapi-generator/vite'
 *
 * export default defineConfig({
 *   plugins: [
 *     openapiGenerator({
 *       input: 'http://localhost:3000/openapi/json',
 *     }),
 *   ],
 * })
 * ```
 */
export function openapiGenerator(opts: OpenapiGeneratorOptions): Plugin {
  const { watch = true, watchDebounce = 30, runOnBuild = false } = opts
  // Wall-clock of the last successful runGenerate triggered by watchChange.
  // `null` means nothing has run yet, so the first watchChange is never
  // debounced. Reset only after generation completes, so a long-running
  // regenerate does not shorten the next window.
  let lastRunAt: number | null = null
  let outputDir: string | undefined
  let inputAbs: string | undefined
  // Cache the last-fetched URL body so a watchChange whose fetch returns
  // identical bytes can short-circuit the regenerate (avoids spurious HMR
  // invalidations from writing bit-for-bit equal files).
  let lastUrlContent: string | null = null
  // 默认 build 模式来兜底任何 configResolved 未先执行的异常路径（CI 直接调 buildStart、
  // hook 顺序被破坏等），让 buildStart 因 command==='build' 直接早返回，
  // 避免在 plugin 装载失败时仍然去 fetch URL / 读文件 / 跑 generate。
  let command: 'serve' | 'build' = 'build'

  return {
    name: 'openapi-generator',
    async configResolved(config) {
      outputDir = resolveOutputDir(config.root, opts.outputDir)
      inputAbs = resolveInput(config.root, opts.input)
      command = config.command
    },
    async buildStart() {
      if (command === 'build' && !runOnBuild) {
        return
      }
      runGenerate(outputDir!, inputAbs!, opts)
        .then(async () => {
          lastRunAt = Date.now()
          if (isUrl(inputAbs!)) {
            try {
              lastUrlContent = await fetchAsText(inputAbs!)
            } catch {}
          }
        })
        .catch((e) => {
          warn(
            `openapi-generator: failed to generate API files: ${(e as Error).message}`,
          )
        })
    },
    async watchChange(id) {
      if (!watch) {
        return
      }
      // Normalise both sides to forward slashes so the equality check
      // holds on every platform. Vite always hands us a POSIX-style
      // path (e.g. `C:/x/y.json`), while `node:path.resolve` returns
      // backslashes on Windows — a raw byte compare would silently
      // drop every dev-mode regeneration there. `inputAbs` itself
      // keeps its native form for `runGenerate` so `assertAbsolute`
      // recognises it. URLs are left alone — their `:` would
      // otherwise become an OS path separator on Windows.
      const normalisedId = isUrl(id) ? id : toForwardSlash(resolve(id))
      if (normalisedId !== toForwardSlash(inputAbs!)) {
        return
      }
      const now = Date.now()
      if (lastRunAt !== null && now - lastRunAt < watchDebounce * 1000) {
        return
      }
      // A failed URL fetch is treated as "content may have changed" so
      // runGenerate still runs and surfaces the network error through
      // readDocument rather than silently swallowing it.
      if (isUrl(inputAbs!)) {
        try {
          const fresh = await fetchAsText(inputAbs!)
          if (fresh === lastUrlContent && lastUrlContent !== null) {
            return
          }
          lastUrlContent = fresh
        } catch {}
      }
      runGenerate(outputDir!, inputAbs!, opts)
        .then(() => {
          lastRunAt = Date.now()
        })
        .catch((e) => {
          warn(
            `openapi-generator: failed to generate API files: ${(e as Error).message}`,
          )
        })
    },
  }
}

function resolveOutputDir(root: string, outputDir: string | undefined): string {
  if (!outputDir) return join(root, 'src', 'api')
  if (isAbsolute(outputDir)) return outputDir
  return resolve(root, outputDir)
}

/**
 * Normalise a path to forward slashes for cross-platform identity checks.
 *
 * Vite hands `watchChange` a POSIX-style path on every platform (e.g.
 * `C:/x/y.json`), while `node:path.resolve` returns backslashes on
 * Windows. A byte-for-byte compare would silently drop every dev-mode
 * regeneration on Windows, so this helper normalises both sides before
 * the equality check. Exported for unit tests.
 */
export function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/')
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
