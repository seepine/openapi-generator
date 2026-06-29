import type { MethodAst } from './methodType'
import { printType, printObjectInline } from '../parser/printers'

/**
 * Wormhole-style JSDoc block. Each section appears only when its data
 * exists; summary falls back to description when summary is absent.
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
