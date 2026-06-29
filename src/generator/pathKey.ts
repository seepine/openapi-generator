import { tagKey } from '../utils/strings'

/**
 * Build the literal `tag.operationId` key shared by the apiDefinitions
 * runtime map and the generated `Alova2Method<..., '${key}', Config>`
 * signature in globals.d.ts. Centralized in `tagKey()` so the apiDefinitions
 * key, the interface property, and the runtime lookup key stay byte-identical.
 */
export function buildPathKey(tag: string, operationId: string): string {
  return `${tagKey(tag)}.${operationId}`
}
