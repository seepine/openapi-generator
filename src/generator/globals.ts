import type { MethodAst } from './methodType'
import { buildMethodSignature } from './methodType'
import { renderHeaderComment } from '../writer/header'
import { IMPORTS, HEADER_TYPES } from './headerTypes'
import { tagKey } from '../utils/strings'

/**
 * Generate the globals.d.ts content from pre-built MethodAst values.
 *
 *   declare global {
 *     interface Apis {
 *       <tag>: {
 *         /** ... *\/
 *         <opId><...>(...): Alova2Method<..., '<tag>.<opId>', Config>;
 *       };
 *     }
 *     var Apis: Apis;
 *   }
 *   export {};
 *
 * Tags are normalised upstream in the loader so the interface property,
 * the apiDefinitions key, and the runtime lookup key stay byte-identical
 * and legal TS.
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
    // Defense-in-depth: re-apply toIdentifier for callers that bypass the
    // loader (e.g. unit tests feeding raw tags).
    const tag = tagKey(currentTag ?? '')
    tagBlocks.push(`    ${tag}: {\n${methodStrs.join('\n')}\n    };`)
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
