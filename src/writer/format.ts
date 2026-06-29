import { format } from 'dprint-node'

/**
 * Format a generated TypeScript source string with dprint.
 *
 * Why this exists: the generator emits TypeScript by string concatenation
 * (templates, printers, hand-rolled object literals). dprint is the
 * source of truth for whitespace, line wrapping, quote style, and trailing
 * commas in this project, so every generated artifact is run through
 * `dprint.format` before it hits disk. Without this pass the printer's
 * own newline/indent heuristics drift away from what `pnpm format` would
 * produce on hand-written code.
 *
 * Option shape: dprint-node accepts a flat object whose keys match the
 * keys of `dprint-plugin-typescript`'s configuration schema
 * (https://dprint.dev/plugins/typescript/config/). This file ONLY pins
 * the keys needed to align dprint with `prettier.config.ts`. Every key
 * below has a `// prettier:` annotation naming the field in
 * `prettier.config.ts` that drives it. Keys that do not appear here
 * fall back to dprint's upstream default — which has been audited to
 * already match the corresponding prettier behaviour for the cases the
 * generator produces (see "Below the fold" below).
 *
 * Implementation notes:
 * - Every option below is derived from `prettier.config.ts`. We do NOT
 *   call `dprint.resolveConfig` and we do NOT pick up the consumer's
 *   config — generated output must be identical regardless of host repo.
 * - The first argument to `format()` is `'inline.ts'`. It is a hint string
 *   used by dprint to pick a plugin based on extension; we never read or
 *   write it from disk. See the dprint docs:
 *   https://dprint.dev/plugins/typescript/config/ — the `filePath` only
 *   determines which formatter plugin runs and has no I/O side effects.
 * - This layer does NOT swallow errors. If dprint rejects the input
 *   (e.g. the printer emitted invalid TS), the caller — `generate()` —
 *   catches it, warns, and writes the unformatted source so a single bad
 *   artifact never blocks the rest of the run.
 *
 * Below the fold — keys intentionally NOT pinned, with reasons:
 *
 * - `quoteProps`: prettier has no equivalent (it normalises property
 *   quoting internally). The generator never emits non-identifier keys,
 *   so dprint's default `'preserve'` produces the same output as
 *   prettier would.
 *
 * - `useTabs`, `indentWidth`, `useBraces`, `bracePosition`, etc.:
 *   dprint's defaults already match prettier's defaults for the cases
 *   the generator produces. Pinning them would add noise without
 *   changing behaviour.
 *
 * - `jsx.*`, `commentLine.*`, `binaryExpression.*`: the generator emits
 *   pure TypeScript with no JSX, no `//comment` collision cases, and
 *   dprint's defaults already match prettier's defaults. No need to
 *   pin.
 *
 * - `preferSingleLine`: upstream is tagged "Very Experimental"; leave
 *   off per upstream's guidance.
 *
 * - `htmlWhitespaceSensitivity`, `proseWrap`, `bracketSameLine`,
 *   `singleAttributePerLine`, `jsxSingleQuote`: prettier concepts that
 *   belong to other plugins (markup_fmt, markdown) or have no dprint
 *   counterpart. They are not relevant for the .ts files this
 *   generator emits.
 */
export async function formatTypeScript(source: string): Promise<string> {
  if (source.trim().length === 0) {
    return source
  }
  // filePathis only used for type inference and does not trigger file I/O reads.
  return format('inline.ts', source, {
    // prettier: printWidth: 80   (dprint default 120)
    lineWidth: 80,
    // prettier: semi: false   (dprint default 'prefer' — split into comments below)
    semiColons: 'asi',
    // prettier: singleQuote: true   (dprint default 'alwaysDouble')
    quoteStyle: 'preferSingle',
    // prettier: trailingComma: 'all'   (dprint has no exact equivalent; the
    // closest is 'always' which adds a trailing comma on single-line arrays
    // too — e.g. ['POST', '/x',]. prettier only adds a trailing comma when
    // the literal spans multiple lines. dprint's 'onlyMultiLine' default
    // matches prettier's actual output more closely for our generator
    // artefacts. See test/writer/format.test.ts for the snapshot that
    // pins this difference.
    trailingCommas: 'onlyMultiLine',
    // prettier: arrowParens: 'always'   (dprint default 'maintain')
    'arrowFunction.useParentheses': 'force',
    // === dprint-only safety pin ===
    // No prettier equivalent. `deno: true` flips several dprint defaults
    // to Deno-flavoured style. We're not Deno, and we don't want a future
    // upstream default change to silently switch us onto that preset.
    deno: false,
  })
}
