import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateApiDefinitions } from '../../src/generator/apiDefinitions'
import type { NormalizedOperation } from '../../src/types'

const META = {
  title: 'Sample',
  version: '1.0.0',
  openapiVersion: '3.1.0',
}

function makeOp(partial: Partial<NormalizedOperation>): NormalizedOperation {
  return {
    tag: '',
    operationId: undefined,
    parameters: [],
    requestBody: undefined,
    responses: [],
    method: 'get',
    path: '/',
    ...partial,
  }
}

describe('generateApiDefinitions', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('1. empty operations → export default {};', () => {
    const out = generateApiDefinitions([], META)
    expect(out).toContain('export default {};')
  })

  it('2. single operation → "<tag>.<operationId>": ["METHOD", "<path>"]', () => {
    const out = generateApiDefinitions(
      [
        makeOp({
          tag: 'auth',
          operationId: 'login',
          method: 'post',
          path: '/auth/login',
        }),
      ],
      META,
    )
    // wormhole-style: single-quoted keys, space-padded tuple, no trailing comma
    expect(out).toContain("  'auth.login': ['POST', '/auth/login']")
  })

  it('3. missing operationId → op skipped; warn called with method and path', () => {
    const out = generateApiDefinitions(
      [
        makeOp({
          tag: 'auth',
          operationId: 'login',
          method: 'post',
          path: '/auth/login',
        }),
        makeOp({
          tag: 'auth',
          operationId: undefined,
          method: 'get',
          path: '/auth/me',
        }),
      ],
      META,
    )
    expect(out).not.toContain('/auth/me')
    expect(warnSpy).toHaveBeenCalled()
    const messages = warnSpy.mock.calls.map((c) => String(c[0]))
    expect(
      messages.some((m) => m.includes('GET') && m.includes('/auth/me')),
    ).toBe(true)
  })

  it('4. duplicate keys → later wins; warn called', () => {
    const out = generateApiDefinitions(
      [
        makeOp({
          tag: 'auth',
          operationId: 'login',
          method: 'post',
          path: '/old',
        }),
        makeOp({
          tag: 'auth',
          operationId: 'login',
          method: 'post',
          path: '/new',
        }),
      ],
      META,
    )
    expect(out).toContain('/new')
    expect(out).not.toContain('/old')
    expect(warnSpy).toHaveBeenCalled()
    const messages = warnSpy.mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes('auth.login'))).toBe(true)
  })

  it('5. missing tag → key uses "default" namespace', () => {
    const out = generateApiDefinitions(
      [makeOp({ tag: '', operationId: 'ping', method: 'get', path: '/ping' })],
      META,
    )
    expect(out).toContain("'default.ping':")
  })

  it('6. header check → reference + wormhole-style comment', () => {
    const out = generateApiDefinitions(
      [
        makeOp({
          tag: 'auth',
          operationId: 'login',
          method: 'post',
          path: '/auth/login',
        }),
      ],
      META,
    )
    const lines = out.split('\n')
    expect(lines[0]).toBe("/// <reference types='./globals.d.ts' />")
    expect(lines[1]).toBe('/* tslint:disable */')
    expect(lines[2]).toBe('/* eslint-disable */')
    expect(lines[3]).toBe('/**')
    expect(lines[4]).toBe(` * ${META.title} - version ${META.version}`)
    expect(lines[6]).toBe(` * OpenAPI version: ${META.openapiVersion}`)
    expect(out).toContain('https://github.com/seepine/openapi-generator')
    expect(out).toContain('**Do not edit the file manually**')
    expect(out).toContain('**该文件由工具自动生成，请勿手动修改**')
  })

  it('7. method uppercased → get becomes GET', () => {
    const out = generateApiDefinitions(
      [
        makeOp({
          tag: 'auth',
          operationId: 'me',
          method: 'get',
          path: '/auth/me',
        }),
      ],
      META,
    )
    expect(out).toContain("  'auth.me': ['GET', '/auth/me']")
  })

  it('8. hyphenated tag is normalized to camelCase in apiDefinitions key', () => {
    // The loader normalizes tags to a legal TS identifier (e.g. `admin-config`
    // → `adminConfig`) so the apiDefinitions lookup key matches the
    // interface property in globals.d.ts. This mirrors wormhole's
    // standardLoader.transformTags behaviour.
    const out = generateApiDefinitions(
      [
        makeOp({
          tag: 'admin-config',
          operationId: 'getConfig',
          method: 'get',
          path: '/admin/config',
        }),
      ],
      META,
    )
    expect(out).toContain("  'adminConfig.getConfig': ['GET', '/admin/config']")
  })
})
