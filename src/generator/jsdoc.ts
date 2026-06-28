import type { MethodAst } from './methodType'
import { printType, printObjectInline } from '../parser/printers'

/**
 * Build a JSDoc block in the wormhole style:
 *
 *   /**
 *    * ---
 *    * [METHOD] summary
 *    * **path:** /foo
 *    * ---
 *    * **Path Parameters**    (only when present)
 *    * ```ts
 *    * type PathParameters = { ... }
 *    * ```
 *    * ---
 *    * **Query Parameters**   (only when present)
 *    * ```ts
 *    * type QueryParameters = { ... }
 *    * ```
 *    * ---
 *    * **RequestBody**        (only when present)
 *    * ```ts
 *    * type RequestBody = { ... }
 *    * ```
 *    * ---
 *    * **Response**
 *    * ```ts
 *    * type Response = { ... }
 *    * ```
 *    *\/
 *
 * Each section appears only when its underlying data exists. Summary falls
 * back to description when summary is absent.
 */
export function buildJSDoc(ast: MethodAst): string {
  const summary = ast.summary ?? ast.description ?? ''
  const pathParamsStr = ast.pathParamsType
    ? printObjectInline(ast.pathParamsType)
    : ''
  const queryParamsStr = ast.queryParamsType
    ? printObjectInline(ast.queryParamsType)
    : ''
  const dataStr = ast.dataType ? printType(ast.dataType) : ''
  const responseStr = printType(ast.responseType)

  const lines: string[] = ['/**']
  // Header block: separator + summary + path
  lines.push(' * ---')
  lines.push(` * [${ast.method}] ${summary}`)
  lines.push(` * **path:** ${ast.path}`)

  if (pathParamsStr) {
    lines.push(' * ---')
    lines.push(' * **Path Parameters**')
    lines.push(' * ```ts')
    lines.push(` * type PathParameters = ${pathParamsStr}`)
    lines.push(' * ```')
  }

  if (queryParamsStr) {
    lines.push(' * ---')
    lines.push(' * **Query Parameters**')
    lines.push(' * ```ts')
    lines.push(` * type QueryParameters = ${queryParamsStr}`)
    lines.push(' * ```')
  }

  if (dataStr) {
    lines.push(' * ---')
    lines.push(' * **RequestBody**')
    lines.push(' * ```ts')
    lines.push(` * type RequestBody = ${dataStr}`)
    lines.push(' * ```')
  }

  lines.push(' * ---')
  lines.push(' * **Response**')
  lines.push(' * ```ts')
  lines.push(` * type Response = ${responseStr}`)
  lines.push(' * ```')

  lines.push(' */')
  return lines.join('\n')
}
