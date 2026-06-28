import type { OpenApiVersion } from '../types'

export function detectVersion(doc: unknown): OpenApiVersion {
  if (typeof doc !== 'object' || doc === null) {
    throw new Error('Unsupported OpenAPI document: root is not an object')
  }
  const obj = doc as Record<string, unknown>
  const openapi = obj.openapi
  const swagger = obj.swagger

  if (typeof openapi === 'string') {
    if (openapi.startsWith('3.0')) return 'openapi30'
    if (openapi.startsWith('3.1')) return 'openapi31'
  }
  if (swagger === '2.0') return 'swagger2'

  throw new Error(
    'Unsupported OpenAPI document: missing or unrecognized version field',
  )
}
