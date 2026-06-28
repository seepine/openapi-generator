import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'
import { parseSchema } from '.'

function extractRefName(ref: string): string | undefined {
  // supports #/components/schemas/X and #/definitions/X
  const m = /^#\/(?:components\/schemas|definitions)\/([^/]+)$/.exec(ref)
  return m ? m[1] : undefined
}

export function parseReference(ctx: ParserContext, ref: string): TsType {
  const name = extractRefName(ref)
  if (!name) return { kind: 'primitive', value: 'unknown' }
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
