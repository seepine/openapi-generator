import { format as prettierFormat } from 'prettier'
import prettierConfig from '../../prettier.config'

/**
 * Format a generated TypeScript source string with Prettier.
 *
 * Why this exists: the generator emits TypeScript by string concatenation
 * (templates, printers, hand-rolled object literals). Prettier is the
 * source of truth for whitespace, line wrapping, quote style, and trailing
 * commas in this project, so every generated artifact is run through
 * `prettier.format` before it hits disk. Without this pass the printer's
 * own newline/indent heuristics drift away from what `pnpm format` would
 * produce on hand-written code.
 *
 * Implementation notes:
 * - The project's `prettier.config.ts` is imported directly (rather than
 *   calling `resolveConfig`) so behavior is identical whether the consumer
 *   of `@seepine/openapi-generator` has their own Prettier config in their
 *   repo. We do NOT pick up the consumer's config — that would make
 *   generated output drift depending on the host project.
 * - `parser` is hard-pinned to `typescript` because several artifacts
 *   (`globals.d.ts`) contain TS-only syntax (`declare global`, generics)
 *   that would fail under Prettier's default `babel` parser.
 * - This layer does NOT swallow errors. If Prettier rejects the input
 *   (e.g. the printer emitted invalid TS), the caller — `generate()` —
 *   catches it, warns, and writes the unformatted source so a single bad
 *   artifact never blocks the rest of the run.
 */
export async function formatTypeScript(source: string): Promise<string> {
  if (source.trim().length === 0) return source
  return prettierFormat(source, { ...prettierConfig, parser: 'typescript' })
}
