import type { JsonSchema } from '../types'

export type ForwardTarget =
  | 'const'
  | 'enum'
  | 'union' // oneOf / anyOf
  | 'intersection' // allOf
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'array'
  | 'object'
  | 'unknown'

export function forward(schema: JsonSchema | undefined): ForwardTarget {
  if (!schema) return 'unknown'
  if ('const' in schema && schema.const !== undefined) return 'const'
  if ('enum' in schema && Array.isArray(schema.enum)) return 'enum'
  if ('oneOf' in schema && Array.isArray(schema.oneOf)) return 'union'
  if ('anyOf' in schema && Array.isArray(schema.anyOf)) return 'union'
  if ('allOf' in schema && Array.isArray(schema.allOf)) return 'intersection'

  // 3.1 type can be an array (e.g., ['string', 'null']); the array form is
  // handled by `parseTypeArray` before dispatch, so any remaining array form
  // falls through here as 'unknown' to avoid a misleading 'object' label.
  if (Array.isArray(schema.type)) return 'unknown'

  switch (schema.type) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    case 'array':
      return 'array'
    case 'object':
      return 'object'
    default:
      return 'unknown'
  }
}
