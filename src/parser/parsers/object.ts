import type { JsonSchema } from '../../types'
import type { TsType, TsProperty, ParserContext } from '../types'
import { parseSchema } from '.'

function isNullType(t: TsType): boolean {
  if (t.kind === 'primitive' && t.value === 'null') return true
  if (t.kind === 'union') return t.types.some(isNullType)
  return false
}

export function parseObject(ctx: ParserContext, schema: JsonSchema): TsType {
  const props = (schema.properties ?? {}) as Record<
    string,
    JsonSchema | undefined
  >
  const required = new Set<string>(
    Array.isArray(schema.required) ? (schema.required as string[]) : [],
  )

  // Preserve insertion order
  const properties: TsProperty[] = []
  for (const [key, value] of Object.entries(props)) {
    let t: TsType = value
      ? parseSchema({ ...ctx, depth: ctx.depth + 1 }, value)
      : { kind: 'primitive', value: 'unknown' }
    // OpenAPI 3.0 `nullable: true` on a property: union the parsed type with
    // null. OpenAPI 3.1 expresses the same shape with `type: [<T>, 'null']`,
    // which the parser already handles via union flattening.
    //
    // The inner parser may have already produced a `T | null` union (e.g.
    // when the property schema itself carries `nullable: true` and is routed
    // through `parseSimple`). Guard against emitting a doubled `| null`.
    const nullable =
      value !== undefined && (value as { nullable?: boolean }).nullable === true
    if (nullable && !isNullType(t)) {
      t = { kind: 'union', types: [t, { kind: 'primitive', value: 'null' }] }
    }
    properties.push({
      name: key,
      type: t,
      optional: !required.has(key),
      description: (value as { description?: string } | undefined)?.description,
    })
  }

  return { kind: 'object', properties }
}
