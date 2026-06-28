import { describe, it, expect } from 'vitest'
import { detectVersion } from '../../src/loader/detectVersion'
import { normalize } from '../../src/loader/normalize'
import type { OpenApiVersion } from '../../src/types'

describe('detectVersion', () => {
  it('detects swagger 2.0', () => {
    expect(detectVersion({ swagger: '2.0' })).toBe<OpenApiVersion>('swagger2')
  })

  it('detects openapi 3.0', () => {
    expect(detectVersion({ openapi: '3.0.0' })).toBe<OpenApiVersion>(
      'openapi30',
    )
  })

  it('detects openapi 3.1', () => {
    expect(detectVersion({ openapi: '3.1.0' })).toBe<OpenApiVersion>(
      'openapi31',
    )
  })

  it('throws when version field missing', () => {
    expect(() => detectVersion({})).toThrow(/version/)
  })

  it('throws when root is not an object', () => {
    expect(() => detectVersion(null)).toThrow(/not an object/)
    expect(() => detectVersion('hi')).toThrow(/not an object/)
  })
})

describe('normalize — swagger2 with body parameter', () => {
  const doc = JSON.parse(`{
    "swagger": "2.0",
    "info": { "title": "T", "version": "1.0" },
    "paths": {
      "/login": {
        "post": {
          "operationId": "login",
          "tags": ["auth"],
          "parameters": [
            {
              "name": "body",
              "in": "body",
              "required": true,
              "schema": {
                "type": "object",
                "properties": { "username": { "type": "string" } }
              }
            }
          ],
          "responses": {
            "200": {
              "schema": {
                "type": "object",
                "properties": { "token": { "type": "string" } }
              }
            }
          }
        }
      }
    }
  }`)

  const out = normalize(doc, 'swagger2')

  it('has version swagger2', () => {
    expect(out.version).toBe('swagger2')
  })

  it('has 1 operation', () => {
    expect(out.operations.length).toBe(1)
  })

  it('captures first tag', () => {
    expect(out.operations[0]!.tag).toBe('auth')
  })

  it('captures operationId and method', () => {
    expect(out.operations[0]!.operationId).toBe('login')
    expect(out.operations[0]!.method).toBe('post')
  })

  it('moves body parameter to requestBody', () => {
    expect(out.operations[0]!.requestBody?.mediaType).toBe('application/json')
    expect(out.operations[0]!.requestBody?.required).toBe(true)
    expect(out.operations[0]!.requestBody?.schema).toBeDefined()
  })

  it('wraps response schema with status 200', () => {
    expect(out.operations[0]!.responses[0]!.status).toBe('200')
    expect(out.operations[0]!.responses[0]!.mediaType).toBe('application/json')
    expect(out.operations[0]!.responses[0]!.schema).toBeDefined()
  })
})

describe('normalize — openapi30 with multiple parameters', () => {
  const doc = JSON.parse(`{
    "openapi": "3.0.0",
    "info": { "title": "T", "version": "1.0" },
    "paths": {
      "/users/{id}": {
        "get": {
          "operationId": "getUser",
          "tags": ["user"],
          "parameters": [
            { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } },
            { "name": "verbose", "in": "query", "required": false, "schema": { "type": "boolean" } }
          ],
          "responses": {
            "200": {
              "description": "ok",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": { "name": { "type": "string" } }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`)

  const out = normalize(doc, 'openapi30')

  it('has version openapi30', () => {
    expect(out.version).toBe('openapi30')
  })

  it('has 1 operation with 2 parameters', () => {
    expect(out.operations.length).toBe(1)
    expect(out.operations[0]!.parameters.length).toBe(2)
  })

  it('captures path + query parameter types', () => {
    const params = out.operations[0]!.parameters
    expect(params.find((p) => p.name === 'id')?.in).toBe('path')
    expect(params.find((p) => p.name === 'id')?.required).toBe(true)
    expect(params.find((p) => p.name === 'verbose')?.in).toBe('query')
    expect(params.find((p) => p.name === 'verbose')?.required).toBe(false)
  })

  it('picks application/json response media type', () => {
    expect(out.operations[0]!.responses[0]!.mediaType).toBe('application/json')
    expect(out.operations[0]!.responses[0]!.status).toBe('200')
  })

  it('tags response schema with _version 3.0', () => {
    const schema = out.operations[0]!.responses[0]!.schema
    expect(schema).toBeDefined()
    expect((schema as { _version?: string })?._version).toBe('3.0')
  })
})

describe('normalize — openapi31 with primitive schema', () => {
  const doc = JSON.parse(`{
    "openapi": "3.1.0",
    "info": { "title": "T", "version": "1.0" },
    "paths": {
      "/test": {
        "get": {
          "operationId": "test",
          "responses": {
            "200": {
              "description": "ok",
              "content": {
                "application/json": {
                  "schema": { "type": "string" }
                }
              }
            }
          }
        }
      }
    }
  }`)

  const out = normalize(doc, 'openapi31')

  it('has version openapi31', () => {
    expect(out.version).toBe('openapi31')
  })

  it('preserves operationId', () => {
    expect(out.operations[0]!.operationId).toBe('test')
  })

  it('preserves schema with _version 3.1', () => {
    const schema = out.operations[0]!.responses[0]!.schema
    expect(schema).toBeDefined()
    expect((schema as { _version?: string })?._version).toBe('3.1')
    expect(JSON.stringify(schema)).toContain('"type":"string"')
  })
})

describe('normalize — error cases', () => {
  it('throws when paths missing', () => {
    expect(() => normalize({}, 'openapi30')).toThrow(/paths/)
  })

  it('throws when paths empty', () => {
    expect(() => normalize({ paths: {} }, 'openapi30')).toThrow(/paths/)
  })

  it('throws when root is not an object (null)', () => {
    expect(() => normalize(null, 'openapi30')).toThrow(/not an object/)
  })

  it('throws when root is not an object (string)', () => {
    expect(() => normalize('not-an-object', 'openapi30')).toThrow(
      /not an object/,
    )
  })

  it('throws on unsupported OpenApiVersion (defensive default branch)', () => {
    // The exhaustive `never` branch is only reachable if a caller passes a
    // bogus version literal; runtime callers should not see this.
    expect(() =>
      normalize({ paths: { '/x': { get: {} } } }, 'unknown' as OpenApiVersion),
    ).toThrow(/Unsupported OpenAPI version/)
  })
})

describe('normalize — operations missing operationId', () => {
  const doc = JSON.parse(`{
    "openapi": "3.0.0",
    "info": { "title": "T", "version": "1.0" },
    "paths": {
      "/x": {
        "get": {
          "responses": { "200": { "description": "ok" } }
        }
      }
    }
  }`)

  const out = normalize(doc, 'openapi30')

  it('still includes the operation (loader does not drop it)', () => {
    expect(out.operations.length).toBe(1)
    expect(out.operations[0]!.operationId).toBeUndefined()
  })
})

describe('normalize — response priority ordering', () => {
  it('prefers 201 over 200 when 200 absent', () => {
    const doc = JSON.parse(`{
      "openapi": "3.0.0",
      "info": { "title": "T", "version": "1.0" },
      "paths": {
        "/x": {
          "get": {
            "operationId": "x",
            "responses": {
              "201": { "description": "created" },
              "default": { "description": "fallback" }
            }
          }
        }
      }
    }`)
    const out = normalize(doc, 'openapi30')
    expect(out.operations[0]!.responses[0]!.status).toBe('201')
  })

  it('falls back to default when no 2xx present', () => {
    const doc = JSON.parse(`{
      "openapi": "3.0.0",
      "info": { "title": "T", "version": "1.0" },
      "paths": {
        "/x": {
          "get": {
            "operationId": "x",
            "responses": {
              "400": { "description": "bad" },
              "default": { "description": "fallback" }
            }
          }
        }
      }
    }`)
    const out = normalize(doc, 'openapi30')
    expect(out.operations[0]!.responses[0]!.status).toBe('default')
  })
})

describe('normalize — swagger2 with formData parameters', () => {
  const doc = JSON.parse(`{
    "swagger": "2.0",
    "info": { "title": "T", "version": "1.0" },
    "paths": {
      "/upload": {
        "post": {
          "operationId": "upload",
          "consumes": ["multipart/form-data"],
          "parameters": [
            { "name": "file", "in": "formData", "type": "file", "required": true },
            { "name": "name", "in": "formData", "type": "string" }
          ],
          "responses": { "200": { "description": "ok" } }
        }
      }
    }
  }`)
  const out = normalize(doc, 'swagger2')
  it('synthesizes a requestBody from formData params', () => {
    expect(out.operations[0]!.requestBody).toBeDefined()
    expect(out.operations[0]!.requestBody?.mediaType).toBe('application/json')
  })
})
