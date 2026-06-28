import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'
import { parseSchema } from '.'

export function parseArray(ctx: ParserContext, schema: JsonSchema): TsType {
  const items = (schema as { items?: JsonSchema }).items
  const itemType: TsType = items
    ? parseSchema({ ...ctx, depth: ctx.depth + 1 }, items)
    : { kind: 'primitive', value: 'unknown' }
  return { kind: 'array', item: itemType }
}
