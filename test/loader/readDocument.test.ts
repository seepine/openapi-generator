import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import { isUrl } from '../../src/utils/is'
import { readDocument } from '../../src/loader/readDocument'

const REPO_ROOT = resolve(__dirname, '../..')

describe('isUrl', () => {
  it('matches http://', () => {
    expect(isUrl('http://example.com/spec.json')).toBe(true)
  })

  it('matches https://', () => {
    expect(isUrl('https://example.com/spec.json')).toBe(true)
  })

  it('is case-insensitive on the scheme', () => {
    expect(isUrl('HTTPS://example.com/spec.json')).toBe(true)
    expect(isUrl('Http://example.com/spec.json')).toBe(true)
  })

  it('does NOT match absolute file paths', () => {
    expect(isUrl('/foo/bar/openapi.json')).toBe(false)
    expect(isUrl('/tmp/spec.json')).toBe(false)
  })

  it('does NOT match relative paths', () => {
    expect(isUrl('./openapi.json')).toBe(false)
    expect(isUrl('openapi.json')).toBe(false)
  })

  it('does NOT match ftp or other schemes', () => {
    expect(isUrl('ftp://example.com/spec.json')).toBe(false)
    expect(isUrl('file:///tmp/spec.json')).toBe(false)
  })
})

describe('readDocument — URL input', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/spec.json') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            openapi: '3.0.0',
            info: { title: 'Remote', version: '1.0' },
            paths: {
              '/ping': {
                get: {
                  operationId: 'ping',
                  responses: { '200': { description: 'ok' } },
                },
              },
            },
          }),
        )
        return
      }
      if (req.url === '/bad.json') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{ not valid json')
        return
      }
      if (req.url === '/404.json') {
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end('not found')
        return
      }
      res.writeHead(500)
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    if (addr && typeof addr === 'object') {
      baseUrl = `http://127.0.0.1:${addr.port}`
    } else {
      throw new Error('failed to bind test server')
    }
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('fetches and parses a JSON document via http', async () => {
    const doc = await readDocument(`${baseUrl}/spec.json`)
    expect(doc).toMatchObject({
      openapi: '3.0.0',
      info: { title: 'Remote' },
      paths: { '/ping': { get: { operationId: 'ping' } } },
    })
  })

  it('throws a descriptive error when HTTP status is non-2xx', async () => {
    await expect(readDocument(`${baseUrl}/404.json`)).rejects.toThrow(
      /Failed to fetch OpenAPI document .* HTTP 404/,
    )
  })

  it('throws a descriptive error when body is not valid JSON', async () => {
    await expect(readDocument(`${baseUrl}/bad.json`)).rejects.toThrow(
      /Failed to parse OpenAPI document/,
    )
  })

  it('wraps network-layer fetch errors with the URL', async () => {
    // Point at a closed port to force fetch to reject at the network layer
    // (not at the HTTP-status check).
    await expect(
      readDocument('http://127.0.0.1:1/definitely-closed.json'),
    ).rejects.toThrow(
      /Failed to fetch OpenAPI document at http:\/\/127\.0\.0\.1:1/,
    )
  })

  it('throws a clear error when global fetch is unavailable', async () => {
    // Simulate a Node environment that pre-dates fetch (Node < 18).
    const originalFetch = (globalThis as { fetch?: unknown }).fetch
    delete (globalThis as { fetch?: unknown }).fetch
    try {
      await expect(
        readDocument('http://example.com/spec.json'),
      ).rejects.toThrow(/global fetch\(\) is not available/)
    } finally {
      ;(globalThis as { fetch?: unknown }).fetch = originalFetch
    }
  })
})

describe('readDocument — file input (unchanged behavior)', () => {
  it('reads and parses a local .json file', async () => {
    const path = `${REPO_ROOT}/test/usecases/swagger_2/openapi.json`
    const doc = await readDocument(path)
    expect(typeof doc).toBe('object')
    expect(doc).toHaveProperty('swagger')
  })

  it('throws when local file is missing', async () => {
    await expect(readDocument('/nonexistent/openapi.json')).rejects.toThrow(
      /Failed to read OpenAPI document/,
    )
  })

  it('throws when local file is not valid JSON', async () => {
    // AGENTS.md is a real, readable, non-JSON file in the repo. Using it
    // keeps the test deterministic across platforms, unlike /proc/version
    // which only exists on Linux.
    await expect(readDocument(`${REPO_ROOT}/AGENTS.md`)).rejects.toThrow(
      /Failed to parse OpenAPI document/,
    )
  })
})
