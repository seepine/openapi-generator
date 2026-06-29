import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'

export function parseSimple(ctx: ParserContext, schema: JsonSchema): TsType {
  const t = schema.type as string

  // `format` is a validation hint in OpenAPI (email / date-time / uri /
  // binary / cuid / ...); TS has no native Date / Email / UUID type, so
  // format is intentionally ignored. The generator is type-only and does
  // not enforce validation.
  let base: TsType
  if (t === 'string') {
    base = { kind: 'primitive', value: 'string' }
  } else if (t === 'number' || t === 'integer') {
    base = { kind: 'primitive', value: 'number' }
  } else if (t === 'boolean') {
    base = { kind: 'primitive', value: 'boolean' }
  } else if (t === 'null') {
    base = { kind: 'primitive', value: 'null' }
  } else {
    base = { kind: 'primitive', value: 'unknown' }
  }

  // 3.0 nullable: true → union with null
  const nullable = (schema as { nullable?: boolean }).nullable === true
  return nullable
    ? { kind: 'union', types: [base, { kind: 'primitive', value: 'null' }] }
    : base
}
