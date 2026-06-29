import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'

// OpenAPI uses `format: 'binary'` on `type: 'string'` to mean "this field
// carries arbitrary binary content" (file uploads, etc.). TS has no native
// binary primitive, but `Blob` is a global type in DOM-flavored lib
// declarations and is the most accurate model for a binary payload the
// consumer intends to read (file / blob / fetch Response.blob()).
//
// `contentEncoding: 'binary'` is the JSON-Schema spelling (RFC 11.3 §RFC8726)
// and is treated as an equivalent hint for the same type. Other `format`
// values (email / date-time / uri / cuid / ...) are intentionally ignored —
// the generator is type-only and does not enforce validation.
const isBinary = (schema: JsonSchema): boolean => {
  const { format, contentEncoding } = schema as Record<string, unknown>
  return format === 'binary' || contentEncoding === 'binary'
}

export function parseSimple(ctx: ParserContext, schema: JsonSchema): TsType {
  const t = schema.type as string

  let base: TsType
  if (isBinary(schema)) {
    base = { kind: 'primitive', value: 'Blob' }
  } else if (t === 'string') {
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
