import type { NormalizedOperation, JsonSchema } from '../types'
import type { TsType, TsProperty, ParserContext } from '../parser/types'
import { parseSchema } from '../parser/parsers'
import { printType, printObjectInline } from '../parser/printers'
import { buildJSDoc } from './jsdoc'
import { buildPathKey } from './pathKey'

export interface MethodAst {
  tag: string
  operationId: string
  method:
    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE'
  path: string
  summary?: string
  description?: string
  /** Request body schema only. `pathParams` is exposed separately. */
  dataType: TsType | undefined
  /** path parameter schema (rendered under `pathParams:` in the signature). */
  pathParamsType: TsType | undefined
  /** query parameter schema (rendered under `params:` in the signature). */
  queryParamsType: TsType | undefined
  responseType: TsType
}

/** Build the parser context from a doc. */
export function makeParserContext(
  schemas: Record<string, JsonSchema>,
): ParserContext {
  return { schemas, refStack: new Set(), depth: 0 }
}

/** Parse a parameter's schema, recursing at +1 depth; falls back to a sensible default. */
function parseParamSchema(
  ctx: ParserContext,
  schema: JsonSchema | undefined,
  fallback: TsType,
): TsType {
  return schema
    ? parseSchema({ ...ctx, depth: ctx.depth + 1 }, schema)
    : fallback
}

/**
 * Build the path-parameter schema only (no merging). Mirrors wormhole's
 * separation: `pathParams` is exposed as a standalone field in the
 * alova MethodConfig, distinct from `data` (request body).
 */
function buildPathParamsType(
  op: NormalizedOperation,
  ctx: ParserContext,
): TsType | undefined {
  const props: TsProperty[] = op.parameters
    .filter((p) => p.in === 'path')
    .map((p) => ({
      name: p.name,
      type: parseParamSchema(ctx, p.schema, {
        kind: 'primitive',
        value: 'string',
      }),
      optional: !p.required,
    }))
  if (props.length === 0) return undefined
  return { kind: 'object', properties: props }
}

/** Build the request body schema only. */
function buildBodyType(
  op: NormalizedOperation,
  ctx: ParserContext,
): TsType | undefined {
  if (!op.requestBody?.schema) return undefined
  return parseSchema({ ...ctx, depth: ctx.depth + 1 }, op.requestBody.schema)
}

/** Build the params (query) type. */
export function buildParamsType(
  op: NormalizedOperation,
  ctx: ParserContext,
): TsType | undefined {
  const props: TsProperty[] = op.parameters
    .filter((p) => p.in === 'query')
    .map((p) => ({
      name: p.name,
      type: parseParamSchema(ctx, p.schema, {
        kind: 'primitive',
        value: 'unknown',
      }),
      optional: !p.required,
    }))
  if (props.length === 0) return undefined
  return { kind: 'object', properties: props }
}

/**
 * Build the response type from the first 2xx response.
 *
 * Matches wormhole's `parseResponse`: when no successful response or its
 * schema is empty, emit `unknown` rather than `null`. `null` is reserved for
 * the rare case where the spec literally documents `nullable: true` /
 * `type: 'null'`.
 */
export function buildResponseType(
  op: NormalizedOperation,
  ctx: ParserContext,
): TsType {
  for (const r of op.responses) {
    if (r.schema) return parseSchema({ ...ctx, depth: ctx.depth + 1 }, r.schema)
  }
  return { kind: 'primitive', value: 'unknown' }
}

export function buildMethodAst(
  op: NormalizedOperation,
  ctx: ParserContext,
): MethodAst {
  return {
    tag: op.tag,
    operationId: op.operationId ?? '',
    method: op.method.toUpperCase() as MethodAst['method'],
    path: op.path,
    summary: op.summary,
    description: op.description,
    dataType: buildBodyType(op, ctx),
    pathParamsType: buildPathParamsType(op, ctx),
    queryParamsType: buildParamsType(op, ctx),
    responseType: buildResponseType(op, ctx),
  }
}

/**
 * Build the full method block (JSDoc + signature) for one operation.
 *
 * Output (matches wormhole globals.d.handlebars):
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
 *    name<Config extends Alova2MethodConfig<Resp> & {
 *      pathParams: { ... };  (when present)
 *      params:     { ... };  (when present)
 *      data:       { ... };  (when present)
 *    }>(
 *      config: Config
 *    ): Alova2Method<Resp, 'tag.operationId', Config>;
 *
 * Indent: 6 spaces inside the interface block (4 for tag + 2 for method).
 */
export function buildMethodSignature(ast: MethodAst): string {
  const respStr = printType(ast.responseType)
  const pathKey = buildPathKey(ast.tag, ast.operationId)

  const parts: string[] = []
  if (ast.pathParamsType) {
    parts.push(`pathParams: ${printObjectInline(ast.pathParamsType)}`)
  }
  if (ast.queryParamsType) {
    parts.push(`params: ${printObjectInline(ast.queryParamsType)}`)
  }
  if (ast.dataType) {
    parts.push(`data: ${printType(ast.dataType)}`)
  }

  const configType =
    parts.length === 0
      ? `Alova2MethodConfig<${respStr}>`
      : `Alova2MethodConfig<${respStr}> & { ${parts.join('; ')}; }`

  const configParam = parts.length === 0 ? 'config?: Config' : 'config: Config'

  const sig = `${ast.operationId}<Config extends ${configType}>(${configParam}): Alova2Method<${respStr}, '${pathKey}', Config>;`

  // Re-indent the JSDoc block to match the signature's 6-space indent.
  const indentedJsdoc = buildJSDoc(ast)
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n')

  return `${indentedJsdoc}\n      ${sig}`
}
