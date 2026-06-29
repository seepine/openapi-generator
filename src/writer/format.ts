import dprint from 'dprint-node'

/**
 * Format a generated TypeScript source string with dprint.
 *
 * The generator emits TypeScript by string concatenation, so dprint is the
 * single source of truth for whitespace, line wrapping, quote style, and
 * trailing commas. Errors are NOT swallowed: `generate()` catches them,
 * warns, and writes the unformatted source so one bad artifact never blocks
 * the rest of the run.
 *
 * Option shape: keys map to `dprint-plugin-typescript` config
 * (https://dprint.dev/plugins/typescript/config/). Only the keys needed to
 * align dprint with the host project's formatting are pinned; unlisted keys
 * fall back to dprint's upstream default, which already matches prettier for
 * the cases the generator produces.
 */
export async function formatTypeScript(source: string = ''): Promise<string> {
  if (source.trim().length === 0) {
    return source
  }
  return dprint.format('inline.ts', source, {
    // dprint: lineWidth
    lineWidth: 80,
    // dprint: semiColons
    semiColons: 'asi',
    // dprint: quoteStyle
    quoteStyle: 'preferSingle',
    // dprint: trailingCommas. dprint's default matches prettier's multi-line
    // trailing-comma behaviour more closely than 'always'.
    trailingCommas: 'onlyMultiLine',
    // dprint: arrowFunction.useParentheses
    'arrowFunction.useParentheses': 'force',
    // dprint-only safety pin: we are not Deno, and we don't want a future
    // upstream default change to silently switch us onto the Deno preset.
    deno: false,
  })
}
