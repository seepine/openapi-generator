import dprint from 'dprint-node'

/**
 * Format a generated TypeScript source string with dprint.
 *
 * The generator emits TS by string concatenation, so dprint is the single
 * source of truth for whitespace, line wrapping, quote style, and trailing
 * commas. Errors are NOT swallowed: `generate()` catches them, warns, and
 * writes the unformatted source so one bad artifact never blocks the run.
 *
 * Option keys map to `dprint-plugin-typescript` config
 * (https://dprint.dev/plugins/typescript/config/). Unlisted keys fall back
 * to dprint's upstream default, which already matches prettier for the
 * cases the generator produces.
 */
export async function formatTypeScript(source: string = ''): Promise<string> {
  if (source.trim().length === 0) {
    return source
  }
  return dprint.format('inline.ts', source, {
    lineWidth: 100,
    semiColons: 'asi',
    quoteStyle: 'preferSingle',
    // dprint's default matches prettier's multi-line trailing-comma
    // behaviour more closely than 'always'.
    trailingCommas: 'onlyMultiLine',
    'arrowFunction.useParentheses': 'force',
    // Pin: we are not Deno, so a future upstream default change cannot
    // silently switch us onto the Deno preset.
    deno: false,
  })
}
