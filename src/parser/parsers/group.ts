import type { JsonSchema } from '../../types'
import type { TsType, TsProperty, ParserContext } from '../types'
import { parseSchema } from '.'
import { warn } from '../../utils/logger'

export function parseGroup(
  ctx: ParserContext,
  schema: JsonSchema,
  kind: 'union' | 'intersection',
): TsType {
  const branches = ((kind === 'union'
    ? (schema.oneOf ?? schema.anyOf)
    : schema.allOf) ?? []) as JsonSchema[]

  const parsed = branches.map((b) =>
    parseSchema({ ...ctx, depth: ctx.depth + 1 }, b),
  )

  if (kind === 'union') {
    if (parsed.length === 0) return { kind: 'primitive', value: 'unknown' }
    if (parsed.length === 1) return parsed[0]!
    return { kind: 'union', types: parsed }
  }

  // allOf: merge object properties; first occurrence wins on conflict.
  const mergedProps = new Map<string, TsProperty>()
  for (const branch of parsed) {
    if (branch.kind === 'object') {
      for (const prop of branch.properties) {
        if (!mergedProps.has(prop.name)) mergedProps.set(prop.name, prop)
      }
    } else {
      warn('allOf branch is not an object, treating as unknown')
    }
  }
  return { kind: 'object', properties: Array.from(mergedProps.values()) }
}
