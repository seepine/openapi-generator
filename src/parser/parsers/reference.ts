import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'
import { parseSchema } from '.'

export function parseReference(ctx: ParserContext, ref: string): TsType {
  // supports #/components/schemas/X and #/definitions/X
  const m = /^#\/(?:components\/schemas|definitions)\/([^/]+)$/.exec(ref)
  if (!m) return { kind: 'primitive', value: 'unknown' }
  const name = m[1]!
  const target = ctx.schemas[name]
  if (!target) return { kind: 'primitive', value: 'unknown' }
  if (ctx.refStack.has(name)) {
    // cycle → unknown (spec §3.3.5)
    return { kind: 'primitive', value: 'unknown' }
  }
  ctx.refStack.add(name)
  const result = parseSchema({ ...ctx, depth: ctx.depth + 1 }, target)
  ctx.refStack.delete(name)
  return result
}
