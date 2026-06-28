import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'

export function parseEnum(ctx: ParserContext, schema: JsonSchema): TsType {
  const values = (schema.enum ?? []) as unknown[]
  const typeStr = Array.isArray(schema.type) ? schema.type[0] : schema.type

  // Only special-case string/number → literalUnion for the spec's `${'a' | 'b'}` format
  if (typeStr === 'string' || typeStr === 'number') {
    const literals = values.filter(
      (v): v is string | number =>
        typeof v === 'string' || typeof v === 'number',
    )
    if (literals.length > 0) return { kind: 'literalUnion', literals }
  }

  // Mixed/missing type → fallback to union of literals
  const types = values.map(literalType)
  if (types.length === 0) return { kind: 'primitive', value: 'unknown' }
  if (types.length === 1) return types[0]!
  return { kind: 'union', types }
}

function literalType(v: unknown): TsType {
  if (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    v === null
  ) {
    return { kind: 'literal', value: v }
  }
  return { kind: 'primitive', value: 'unknown' }
}
