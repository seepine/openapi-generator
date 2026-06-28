import { describe, it, expect } from 'vitest'
import { renderCreateApis, renderIndex } from '../../src/writer/templates'

const baseCtx = {
  globalName: 'Apis',
  title: 'Sample',
  version: '1.0.0',
  openapiVersion: '3.1.0',
}

describe('renderCreateApis', () => {
  it('replaces __GLOBAL_NAME__ placeholder with Apis (default)', () => {
    const out = renderCreateApis(baseCtx)
    expect(out).not.toContain('__GLOBAL_NAME__')
    expect(out).not.toContain('ConstDiscriminatedUnion')
    expect(out).toContain('as Apis')
    expect(out).toContain('(globalThis as any).Apis = Apis')
  })

  it('replaces with custom globalName', () => {
    const out = renderCreateApis({ ...baseCtx, globalName: 'MyApis' })
    expect(out).toContain('as MyApis')
    expect(out).toContain('(globalThis as any).MyApis = MyApis')
    expect(out).not.toContain('(globalThis as any).Apis')
  })

  it('interpolates the OpenAPI metadata into the header comment', () => {
    const out = renderCreateApis({
      ...baseCtx,
      title: 'Luna OpenAPI',
      version: '0.1.0',
      openapiVersion: '3.0.3',
    })
    expect(out).toContain('Luna OpenAPI - version 0.1.0')
    expect(out).toContain('OpenAPI version: 3.0.3')
  })

  it('contains key exports', () => {
    const out = renderCreateApis(baseCtx)
    expect(out).toContain('export const createApis')
    expect(out).toContain('export const mountApis')
    expect(out).toContain('export const withConfigType')
  })
})

describe('renderIndex', () => {
  it('contains baseURL and alovaInstance', () => {
    const out = renderIndex()
    expect(out).toContain('baseURL')
    expect(out).toContain('alovaInstance')
    expect(out).toContain('createApis')
    expect(out).toContain('mountApis')
  })
})
