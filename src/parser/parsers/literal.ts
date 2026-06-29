import type { TsType } from '../types'

/** Map a JSON-schema const/enum value to its `TsType` literal form. */
export function toLiteralType(value: unknown): TsType {
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
