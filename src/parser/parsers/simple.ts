import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'

export function parseSimple(ctx: ParserContext, schema: JsonSchema): TsType {
  // type has been narrowed by forward() to string/number/boolean/null
  const t = schema.type as string

  // `format` is a validation hint in OpenAPI (email / date-time / uri /
  // binary / cuid / ...) and never narrows the TS type — TS has no
  // native Date / Email / UUID type. Custom formats (e.g. `cuid`) and
  // file-style formats (e.g. `binary`) all stay as the underlying
  // primitive. The generator is type-only and does not enforce validation.
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
