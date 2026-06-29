import type { OpenAPIV3_1, OpenAPIV3, OpenAPIV2 } from 'openapi-types'

export type OpenApiVersion = 'swagger2' | 'openapi30' | 'openapi31'

export type JsonSchema =
  | (OpenAPIV3_1.SchemaObject & { _version: '3.1' })
  | (OpenAPIV3.SchemaObject & { _version: '3.0' })
  | (OpenAPIV2.SchemaObject & { _version: '2.0' })

export type HttpMethod =
  'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace'

/** Internal normalized operation (spec §3.3.4). */
export interface NormalizedOperation {
  /** First tag from the operation's tag array. Literal `"default"` if none. */
  tag: string
  /** Missing means the generator should skip this op. */
  operationId: string | undefined
  summary?: string
  description?: string
  parameters: NormalizedParameter[]
  /** application/json preferred, otherwise first content type. */
  requestBody: NormalizedRequestBody | undefined
  responses: NormalizedResponse[]
  /** Original path string with {paramName} placeholders preserved. */
  path: string
  method: HttpMethod
}

export interface NormalizedParameter {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required: boolean
  schema: JsonSchema | undefined
  description?: string
}

export interface NormalizedRequestBody {
  mediaType: string | undefined
  schema: JsonSchema | undefined
  required: boolean
}

export interface NormalizedResponse {
  status: string
  mediaType: string | undefined
  schema: JsonSchema | undefined
}

export interface NormalizedDoc {
  version: OpenApiVersion
  title: string
  /** Value of `info.version` in the source spec; surfaced in the header. */
  infoVersion: string
  /** Value of `openapi` / `swagger` in the source spec (e.g. `3.0.3`). */
  openapiVersion: string
  operations: NormalizedOperation[]
  /** Unified components.schemas / definitions container. */
  schemas: Record<string, JsonSchema>
}
