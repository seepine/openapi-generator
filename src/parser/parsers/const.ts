import type { JsonSchema } from '../../types'
import type { TsType, ParserContext } from '../types'
import { toLiteralType } from './literal'

export function parseConst(ctx: ParserContext, schema: JsonSchema): TsType {
  return toLiteralType((schema as { const?: unknown }).const)
}
