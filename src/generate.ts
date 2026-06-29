import { resolve } from 'node:path'
import { assertAbsolute, ensureDir } from '@/utils/path'
import { warn } from '@/utils/logger'
import { isUrl } from '@/utils/is'
import { loadDocument } from '@/loader'
import type { NormalizedOperation } from '@/types'
import { generateApiDefinitions } from '@/generator/apiDefinitions'
import { generateGlobals } from '@/generator/globals'
import { buildMethodAst, makeParserContext } from '@/generator/methodType'
import type { MethodAst } from '@/generator/methodType'
import { writeGenerated } from '@/writer/file'
import { formatTypeScript } from '@/writer/format'
import { renderCreateApis, renderIndex } from '@/writer/templates'

export interface GeneratorConfig {
  /**
   * OpenAPI document source.
   * - Local file: absolute path to a `.json` file.
   * - Remote URL: any `http://` / `https://` URL; fetched via global `fetch` (Node >= 18).
   */
  input: string
  /** Output directory absolute path (created if missing). */
  outputDir: string
  /** Global interface name; defaults to 'Apis'. */
  globalName?: string
}

/**
 * Generate alova-friendly TypeScript files from an OpenAPI document.
 *
 * Writes 4 generated files to outputDir:
 *   - apiDefinitions.ts
 *   - globals.d.ts
 *   - createApis.ts
 *   - index.ts (only if missing)
 *
 * Note: no `.prettierignore` is generated — in monorepos with multiple
 * generator outputs, a project-level ignore file is the caller's job.
 *
 * Errors during loading throw immediately; per-operation parse errors
 * skip the failing op with a warning (the rest of the run continues).
 */
export async function generate(options: GeneratorConfig): Promise<void> {
  const { input, outputDir, globalName = 'Apis' } = options

  assertAbsolute(outputDir, 'outputDir')
  // input must be an absolute file path OR a URL; relative paths / remote URL hosts are not validated here
  if (!isUrl(input)) {
    assertAbsolute(input, 'input')
  }
  await ensureDir(outputDir)

  // 1. Load + normalize
  const doc = await loadDocument(input)

  // 2. Build MethodAst for each operation; skip failures
  const ctx = makeParserContext(doc.schemas)
  const successfulOps: NormalizedOperation[] = []
  const methodAsts: MethodAst[] = []
  for (const op of doc.operations) {
    if (!op.operationId) {
      warn(
        `skip operation without operationId at ${op.method.toUpperCase()} ${op.path}`,
      )
      continue
    }
    try {
      methodAsts.push(buildMethodAst(op, ctx))
      successfulOps.push(op)
    } catch (e) {
      warn(
        `failed to parse ${op.method.toUpperCase()} ${op.path}: ${(e as Error).message}`,
      )
    }
  }

  // 3. Generate content
  const meta = {
    title: doc.title || 'OpenAPI',
    version: doc.infoVersion || '1.0.0',
    openapiVersion: doc.openapiVersion,
  }

  // Pre-format every artifact through Prettier so the printer's hand-rolled
  // newlines/indents converge on the project's code style.
  const apiDefsRaw = generateApiDefinitions(successfulOps, meta)
  const globalsRaw = generateGlobals(methodAsts, globalName, meta)
  const createApisRaw = renderCreateApis({ globalName, ...meta })
  const indexRaw = renderIndex()

  const apiDefsContent = await safeFormat(apiDefsRaw, 'apiDefinitions.ts')
  const globalsContent = await safeFormat(globalsRaw, 'globals.d.ts')
  const createApisContent = await safeFormat(createApisRaw, 'createApis.ts')
  const indexContent = await safeFormat(indexRaw, 'index.ts')

  // 4. Write files in spec order. `apiDefinitions` / `globals` / `createApis`
  // are always overwritten (the user is meant to regenerate them). `index.ts`
  // is written with `exclusive: true` so it only appears the first time —
  // once the user takes ownership of the file, we never clobber it.
  await writeGenerated(resolve(outputDir, 'apiDefinitions.ts'), apiDefsContent)
  await writeGenerated(resolve(outputDir, 'globals.d.ts'), globalsContent)
  await writeGenerated(resolve(outputDir, 'createApis.ts'), createApisContent)
  await writeGenerated(resolve(outputDir, 'index.ts'), indexContent, {
    exclusive: true,
  })
}

/**
 * Format `source` with Prettier; on failure, warn and return the raw source
 * so the caller can keep writing unformatted output for that one file.
 * Keeping this wrapper in `generate()` (rather than inside `formatTypeScript`)
 * means the formatter itself stays a single-responsibility transform — its
 * contract is "format, or throw" — and the generator owns the "skip + warn"
 * policy that AGENTS.md applies to every other failure mode here.
 */
async function safeFormat(source: string, filename: string): Promise<string> {
  try {
    return await formatTypeScript(source)
  } catch (e) {
    warn(
      `prettier formatting failed for ${filename}: ${(e as Error).message}; writing unformatted output`,
    )
    return source
  }
}
