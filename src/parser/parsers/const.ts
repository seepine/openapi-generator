import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'

export function parseConst(ctx: ParserContext, schema: JsonSchema): TsType {
  const value = (schema as { const?: unknown }).const
  // accept string/number/boolean/null
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return { kind: 'literal', value }
  }
  return { kind: 'primitive', value: 'unknown' }
}
