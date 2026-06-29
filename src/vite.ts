import { join, resolve, isAbsolute } from 'node:path'
import type { Plugin } from 'vite'
import { generate, type GeneratorConfig } from './generate'
import { fetchAsText } from './loader/readDocument'
import { isUrl } from './utils/is'

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
  const { watch = true, watchDebounce = 30 } = opts
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

  return {
    name: 'openapi-generator',
    async configResolved(config) {
      outputDir = resolveOutputDir(config.root, opts.outputDir)
      inputAbs = resolveInput(config.root, opts.input)
    },
    async buildStart() {
      // Prime the URL cache unconditionally — the equality check needs
      // something to compare against on the first watchChange.
      if (isUrl(inputAbs!)) {
        lastUrlContent = await fetchAsText(inputAbs!)
      }
      await runGenerate(outputDir!, inputAbs!, opts)
      lastRunAt = Date.now()
      // The initial buildStart run does not consume the debounce window,
      // so we deliberately leave it eligible for the first watchChange.
    },
    async watchChange(id) {
      if (!watch) return
      // Normalise file inputs via `path.resolve` so a same-named sibling
      // cannot slip through; leave URLs alone (their `:` would otherwise
      // become an OS path separator on Windows).
      const normalisedId = isUrl(id) ? id : resolve(id)
      if (normalisedId !== inputAbs) return
      const now = Date.now()
      if (lastRunAt !== null && now - lastRunAt < watchDebounce * 1000) {
        return
      }
      // A failed URL fetch is treated as "content may have changed" so
      // runGenerate still runs and surfaces the network error through
      // readDocument rather than silently swallowing it.
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
