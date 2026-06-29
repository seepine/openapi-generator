import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'
import { forward } from '../forward'
import { parseConst } from './const'
import { parseEnum } from './enum'
import { parseSimple } from './simple'
import { parseArray } from './array'
import { parseObject } from './object'
import { parseGroup } from './group'
import { parseReference } from './reference'

const MAX_DEPTH = 30

export function parseSchema(
  ctx: ParserContext,
  schema: JsonSchema | undefined,
): TsType {
  if (!schema) return { kind: 'primitive', value: 'unknown' }
  if (ctx.depth > MAX_DEPTH) return { kind: 'primitive', value: 'unknown' }

  if ('$ref' in schema && typeof schema.$ref === 'string') {
    return parseReference(ctx, schema.$ref)
  }

  // 3.1 type array (e.g. ['string', 'null'])
  if (Array.isArray(schema.type)) {
    return parseTypeArray(ctx, schema)
  }

  const target = forward(schema)

  switch (target) {
    case 'const':
      return parseConst(ctx, schema)
    case 'enum':
      return parseEnum(ctx, schema)
    case 'union':
    case 'intersection':
      return parseGroup(ctx, schema, target)
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return parseSimple(ctx, schema)
    case 'array':
      return parseArray(ctx, schema)
    case 'object':
      return parseObject(ctx, schema)
    default:
      return { kind: 'primitive', value: 'unknown' }
  }
}

function parseTypeArray(ctx: ParserContext, schema: JsonSchema): TsType {
  const typeArr = schema.type as unknown as string[]
  const types = typeArr.filter((t) => t !== 'null')
  const includesNull = typeArr.includes('null')
  const subs: TsType[] = types.map((t) =>
    parseSchema(ctx, { ...schema, type: t } as JsonSchema),
  )
  if (subs.length === 0) return { kind: 'primitive', value: 'null' }
  const base: TsType =
    subs.length === 1 ? subs[0]! : { kind: 'union', types: subs }
  return includesNull
    ? { kind: 'union', types: [base, { kind: 'primitive', value: 'null' }] }
    : base
}
