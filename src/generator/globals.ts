import type { MethodAst } from './methodType'
import { buildMethodSignature } from './methodType'
import { renderHeaderComment } from '../writer/header'
import { IMPORTS, HEADER_TYPES } from './headerTypes'
import { toIdentifier } from '../utils/strings'

/**
 * Generate the globals.d.ts file content from pre-built MethodAst values.
 *
 * Output structure (matches wormhole globals.d.handlebars):
 *
 *   declare global {
 *     interface Apis {
 *       <tag>: {
 *         /**
 *          * ---
 *          ...
 *          *\/
 *         <method><
 *           Config extends ...
 *         >(
 *           config?: Config
 *         ): Alova2Method<..., '<tag>.<method>', Config>;
 *       };
 *       ...
 *     }
 *
 *     var Apis: Apis;
 *   }
 *   export {};
 *
 * Tag identifiers are normalized upstream in the loader (e.g. `admin-config`
 * → `adminConfig`) so the interface property name, the apiDefinitions key,
 * and the runtime lookup key are always identical and legal TypeScript.
 */
export function generateGlobals(
  methodAsts: MethodAst[],
  globalName: string,
  meta: { title: string; version: string; openapiVersion: string },
): string {
  const tagBlocks: string[] = []
  let currentTag: string | undefined
  let currentMethods: MethodAst[] = []

  // Group by tag, preserving first-seen tag order.
  const flush = (): void => {
    if (currentMethods.length === 0) return
    const methodStrs = currentMethods.map(buildMethodSignature)
    // Defense-in-depth: even though the loader normalizes tags, this layer
    // re-applies `toIdentifier` so callers that bypass the loader (e.g.
    // unit tests feeding raw tags) still emit a legal TS interface key.
    const tagKey = currentTag ? toIdentifier(currentTag) : ''
    tagBlocks.push(`    ${tagKey}: {\n${methodStrs.join('\n')}\n    };`)
  }

  for (const ast of methodAsts) {
    if (ast.tag !== currentTag) {
      flush()
      currentTag = ast.tag
      currentMethods = []
    }
    currentMethods.push(ast)
  }
  flush()

  const interfaceBlock =
    tagBlocks.length === 0
      ? `interface ${globalName} {}`
      : `interface ${globalName} {\n${tagBlocks.join('\n')}\n  }`

  return [
    renderHeaderComment(meta),
    '',
    IMPORTS,
    '',
    HEADER_TYPES,
    `declare global {\n  ${interfaceBlock}\n\n  var ${globalName}: ${globalName};\n}`,
    'export {};',
    '',
  ].join('\n')
}
