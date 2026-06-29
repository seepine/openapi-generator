import { tagKey } from '../utils/strings'

/**
 * Build the literal `tag.operationId` key shared by the apiDefinitions
 * runtime map and the `Alova2Method<..., '${key}', Config>` signature in
 * globals.d.ts. Centralising in `tagKey()` keeps the runtime key, the
 * interface property, and the lookup key byte-identical.
 */
export function buildPathKey(tag: string, operationId: string): string {
  return `${tagKey(tag)}.${operationId}`
}
