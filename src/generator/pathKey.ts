import { toIdentifier } from '../utils/strings'

/**
 * Build the literal `tag.operationId` key shared by the apiDefinitions
 * runtime map and the generated `Alova2Method<..., '${key}', Config>`
 * signature in globals.d.ts. Empty tag is preserved verbatim so the two
 * stay byte-identical.
 */
export function buildPathKey(tag: string, operationId: string): string {
  return `${tag ? toIdentifier(tag) : ''}.${operationId}`
}
