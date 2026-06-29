import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type {
  HttpMethod,
  JsonSchema,
  NormalizedDoc,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedRequestBody,
  NormalizedResponse,
  OpenApiVersion,
} from '../types'
import { tagKey } from '../utils/strings'

const HTTP_METHODS: HttpMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
]

const RESPONSE_PRIORITY = ['200', '201', '202', '204', '2xx']

function readOpenapiVersion(
  doc: Record<string, unknown>,
  fallback: string,
): string {
  if (typeof doc.openapi === 'string') return doc.openapi
  if (typeof doc.swagger === 'string') return doc.swagger
  return fallback
}

function isRef(obj: unknown): boolean {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '$ref' in obj &&
    typeof (obj as { $ref: unknown }).$ref === 'string'
  )
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

interface MediaTypeEntry {
  schema?: unknown
}

function pickMediaType(content: Record<string, MediaTypeEntry> | undefined): {
  mediaType: string | undefined
  schema: unknown
} {
  if (!content) return { mediaType: undefined, schema: undefined }
  if (content['application/json']) {
    return {
      mediaType: 'application/json',
      schema: content['application/json'].schema,
    }
  }
  const first = Object.keys(content)[0]
  if (!first) return { mediaType: undefined, schema: undefined }
  return { mediaType: first, schema: content[first]?.schema }
}

/**
 * Wraps a schema object with the version discriminator. Returns undefined for
 * refs (loader does not resolve refs) or missing schemas.
 */
function tagSchema(
  schema: unknown,
  version: '2.0' | '3.0' | '3.1',
  schemas?: Record<string, JsonSchema>,
): JsonSchema | undefined {
  if (schema === undefined || schema === null) return undefined
  if (isRef(schema)) {
    // Resolve `$ref` against the components.schemas map collected upstream.
    // Local refs only (`#/components/schemas/...`); cross-doc refs are out of
    // scope.
    const ref = (schema as { $ref: string }).$ref
    if (!schemas) return undefined
    const m = /^#\/(?:components|definitions)\/schemas\/([^/]+)$/.exec(ref)
    if (!m) return undefined
    const target = schemas[m[1]!]
    return target
  }
  return {
    ...(schema as Record<string, unknown>),
    _version: version,
  } as unknown as JsonSchema
}

// ----------------- V3 (3.0 / 3.1) -----------------

function normalize3xCommon(
  doc: Record<string, unknown>,
  version: '3.0' | '3.1',
): NormalizedDoc {
  const infoObj = doc.info as { title?: string; version?: string } | undefined
  const title = infoObj?.title ?? ''

  const paths = doc.paths
  if (!paths || typeof paths !== 'object' || Object.keys(paths).length === 0) {
    throw new Error('Unsupported OpenAPI document: missing or empty `paths`')
  }

  // Collect components.schemas first so refs in operations can be resolved
  // during the operation walk below.
  const schemas: Record<string, JsonSchema> = {}
  const components = doc.components as
    { schemas?: Record<string, unknown> } | undefined
  if (components?.schemas) {
    for (const [name, schema] of Object.entries(components.schemas)) {
      const tagged = tagSchema(schema, version)
      if (tagged) schemas[name] = tagged
    }
  }

  const operations: NormalizedOperation[] = []
  for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
    if (!isPlainObject(pathItemRaw)) continue
    for (const method of HTTP_METHODS) {
      const op = (pathItemRaw as Record<string, unknown>)[method]
      if (!isPlainObject(op)) continue
      operations.push(
        normalizeOperationV3(pathKey, method, op, version, schemas),
      )
    }
  }

  const versionOut: OpenApiVersion =
    version === '3.0' ? 'openapi30' : 'openapi31'

  const infoVersion = infoObj?.version ?? '1.0.0'
  // Preserve the original `openapi` field value (e.g. `3.0.3`) so the
  // generated header comment matches what the spec declared. Falls back to
  // the detected major version when the field is missing.
  const openapiRaw = readOpenapiVersion(doc, versionOut)

  return {
    version: versionOut,
    title,
    infoVersion,
    openapiVersion: openapiRaw,
    operations,
    schemas,
  }
}

function normalizeOperationV3(
  pathKey: string,
  method: HttpMethod,
  raw: Record<string, unknown>,
  version: '3.0' | '3.1',
  schemas: Record<string, JsonSchema>,
): NormalizedOperation {
  const tags = Array.isArray(raw.tags) ? (raw.tags as unknown[]) : []
  const rawTag = ((tags[0] as string | undefined) ?? '').trim()
  const tag = tagKey(rawTag)

  const opId = typeof raw.operationId === 'string' ? raw.operationId : undefined
  const summary = typeof raw.summary === 'string' ? raw.summary : undefined
  const description =
    typeof raw.description === 'string' ? raw.description : undefined

  // Parameters
  const params: NormalizedParameter[] = []
  const rawParams = raw.parameters
  if (Array.isArray(rawParams)) {
    for (const p of rawParams) {
      if (!isPlainObject(p) || isRef(p)) continue
      const inLoc = p.in as string | undefined
      if (
        inLoc !== 'query' &&
        inLoc !== 'path' &&
        inLoc !== 'header' &&
        inLoc !== 'cookie'
      ) {
        continue
      }
      params.push({
        name: typeof p.name === 'string' ? p.name : '',
        in: inLoc,
        required: p.required === true,
        schema: tagSchema(p.schema, version, schemas),
        description:
          typeof p.description === 'string' ? p.description : undefined,
      })
    }
  }

  // Request body
  let requestBody: NormalizedRequestBody | undefined
  const rawBody = raw.requestBody
  if (isPlainObject(rawBody) && !isRef(rawBody)) {
    const content = rawBody.content as
      Record<string, MediaTypeEntry> | undefined
    const media = pickMediaType(content)
    requestBody = {
      mediaType: media.mediaType,
      schema:
        media.schema !== undefined
          ? tagSchema(media.schema, version, schemas)
          : undefined,
      required: rawBody.required === true,
    }
  }

  // Responses
  const responsesRaw = (raw.responses ?? {}) as Record<string, unknown>
  const responses = fillResponseStatusesV3(responsesRaw, version, schemas)

  return {
    tag,
    operationId: opId,
    summary,
    description,
    parameters: params,
    requestBody,
    responses,
    path: pathKey,
    method,
  }
}

function fillResponseStatusesV3(
  responsesRaw: Record<string, unknown>,
  version: '3.0' | '3.1',
  schemas: Record<string, JsonSchema>,
): NormalizedResponse[] {
  if (!isPlainObject(responsesRaw)) {
    return [{ status: 'default', mediaType: undefined, schema: undefined }]
  }

  const codes = Object.keys(responsesRaw)

  // 1. priority
  for (const code of RESPONSE_PRIORITY) {
    if (codes.includes(code)) {
      return [
        buildResponseFromCodeV3(code, responsesRaw[code], version, schemas),
      ]
    }
  }

  // 2. any 2xx
  for (const code of codes) {
    if (/^2\d{2}$/.test(code)) {
      return [
        buildResponseFromCodeV3(code, responsesRaw[code], version, schemas),
      ]
    }
  }

  // 3. default
  if (codes.includes('default')) {
    return [
      buildResponseFromCodeV3(
        'default',
        responsesRaw.default,
        version,
        schemas,
      ),
    ]
  }

  return [{ status: 'default', mediaType: undefined, schema: undefined }]
}

function buildResponseFromCodeV3(
  status: string,
  raw: unknown,
  version: '3.0' | '3.1',
  schemas: Record<string, JsonSchema>,
): NormalizedResponse {
  if (!isPlainObject(raw) || isRef(raw)) {
    return { status, mediaType: undefined, schema: undefined }
  }
  const content = raw.content as Record<string, MediaTypeEntry> | undefined
  const media = pickMediaType(content)
  return {
    status,
    mediaType: media.mediaType,
    schema:
      media.schema !== undefined
        ? tagSchema(media.schema, version, schemas)
        : undefined,
  }
}

// ----------------- V2 (Swagger 2.0) -----------------

function normalizeV2(doc: Record<string, unknown>): NormalizedDoc {
  const infoObj = doc.info as { title?: string; version?: string } | undefined
  const title = infoObj?.title ?? ''

  const paths = doc.paths
  if (!paths || typeof paths !== 'object' || Object.keys(paths).length === 0) {
    throw new Error('Unsupported OpenAPI document: missing or empty `paths`')
  }

  const schemas: Record<string, JsonSchema> = {}
  const definitions = doc.definitions as Record<string, unknown> | undefined
  if (definitions) {
    for (const [name, schema] of Object.entries(definitions)) {
      const tagged = tagSchema(schema, '2.0')
      if (tagged) schemas[name] = tagged
    }
  }

  const operations: NormalizedOperation[] = []
  for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
    if (!isPlainObject(pathItemRaw)) continue
    for (const method of HTTP_METHODS) {
      const op = (pathItemRaw as Record<string, unknown>)[method]
      if (!isPlainObject(op)) continue
      operations.push(normalizeOperationV2(pathKey, method, op, schemas))
    }
  }

  const infoVersion = infoObj?.version ?? '1.0.0'
  const openapiRaw = readOpenapiVersion(doc, 'swagger2')

  return {
    version: 'swagger2',
    title,
    infoVersion,
    openapiVersion: openapiRaw,
    operations,
    schemas,
  }
}

function normalizeOperationV2(
  pathKey: string,
  method: HttpMethod,
  raw: Record<string, unknown>,
  schemas: Record<string, JsonSchema>,
): NormalizedOperation {
  const tags = Array.isArray(raw.tags) ? (raw.tags as unknown[]) : []
  const rawTag = ((tags[0] as string | undefined) ?? '').trim()
  const tag = tagKey(rawTag)

  const opId = typeof raw.operationId === 'string' ? raw.operationId : undefined
  const summary = typeof raw.summary === 'string' ? raw.summary : undefined
  const description =
    typeof raw.description === 'string' ? raw.description : undefined

  const params: NormalizedParameter[] = []
  let bodySchema: unknown
  let bodyRequired = false

  const rawParams = raw.parameters
  if (Array.isArray(rawParams)) {
    const formProps: Record<string, unknown> = {}
    let hasForm = false

    for (const p of rawParams) {
      if (!isPlainObject(p) || isRef(p)) continue
      const inLoc = p.in as string | undefined
      if (inLoc === 'body') {
        bodySchema = (p as { schema?: unknown }).schema
        bodyRequired = p.required === true
      } else if (inLoc === 'formData') {
        hasForm = true
        const name = typeof p.name === 'string' ? p.name : ''
        const prop: Record<string, unknown> = {}
        if (typeof p.type === 'string') prop.type = p.type
        if (typeof p.format === 'string') prop.format = p.format
        if ('enum' in p) prop.enum = (p as { enum?: unknown }).enum
        if (p.description) prop.description = p.description
        formProps[name] = prop
      } else if (
        inLoc === 'query' ||
        inLoc === 'path' ||
        inLoc === 'header' ||
        inLoc === 'cookie'
      ) {
        params.push({
          name: typeof p.name === 'string' ? p.name : '',
          in: inLoc,
          required: p.required === true,
          schema: tagSchema(p, '2.0', schemas),
          description:
            typeof p.description === 'string' ? p.description : undefined,
        })
      }
    }

    if (hasForm && bodySchema === undefined) {
      bodySchema = {
        type: 'object',
        properties: formProps,
      }
      bodyRequired = true
    }
  }

  let requestBody: NormalizedRequestBody | undefined
  if (bodySchema !== undefined) {
    requestBody = {
      mediaType: 'application/json',
      schema: tagSchema(bodySchema, '2.0', schemas),
      required: bodyRequired,
    }
  }

  const responsesRaw = (raw.responses ?? {}) as Record<string, unknown>
  const responses = fillResponseStatusesV2(responsesRaw, schemas)

  return {
    tag,
    operationId: opId,
    summary,
    description,
    parameters: params,
    requestBody,
    responses,
    path: pathKey,
    method,
  }
}

function fillResponseStatusesV2(
  responsesRaw: Record<string, unknown>,
  schemas: Record<string, JsonSchema>,
): NormalizedResponse[] {
  if (!isPlainObject(responsesRaw)) {
    return [{ status: 'default', mediaType: undefined, schema: undefined }]
  }

  const codes = Object.keys(responsesRaw)

  for (const code of RESPONSE_PRIORITY) {
    if (codes.includes(code)) {
      const built = buildResponseFromCodeV2(code, responsesRaw[code], schemas)
      if (built) return [built]
    }
  }

  for (const code of codes) {
    if (/^2\d{2}$/.test(code)) {
      const built = buildResponseFromCodeV2(code, responsesRaw[code], schemas)
      if (built) return [built]
    }
  }

  if (codes.includes('default')) {
    const built = buildResponseFromCodeV2(
      'default',
      responsesRaw.default,
      schemas,
    )
    if (built) return [built]
  }

  return [{ status: 'default', mediaType: undefined, schema: undefined }]
}

function buildResponseFromCodeV2(
  status: string,
  raw: unknown,
  schemas: Record<string, JsonSchema>,
): NormalizedResponse | undefined {
  if (!isPlainObject(raw) || isRef(raw)) {
    return { status, mediaType: undefined, schema: undefined }
  }
  return {
    status,
    mediaType: 'application/json',
    schema: tagSchema(raw.schema, '2.0', schemas),
  }
}

// ----------------- Public API -----------------

export function normalize(
  doc: unknown,
  version: OpenApiVersion,
): NormalizedDoc {
  if (!isPlainObject(doc)) {
    throw new Error('Unsupported OpenAPI document: root is not an object')
  }

  switch (version) {
    case 'openapi30':
      return normalize3xCommon(doc, '3.0')
    case 'openapi31':
      return normalize3xCommon(doc, '3.1')
    case 'swagger2':
      return normalizeV2(doc)
    default: {
      const exhaustive: never = version
      throw new Error(`Unsupported OpenAPI version: ${exhaustive}`)
    }
  }
}

export type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 }
