import { describe, it, expect } from 'vitest'
import { generateGlobals } from '../../src/generator/globals'
import {
  buildMethodAst,
  makeParserContext,
} from '../../src/generator/methodType'
import type { MethodAst } from '../../src/generator/methodType'
import type { NormalizedOperation, JsonSchema } from '../../src/types'
import { createStrReg } from '../_helper'

function makeOp(overrides: Partial<NormalizedOperation>): NormalizedOperation {
  return {
    tag: 'auth',
    operationId: 'login',
    method: 'post',
    path: '/auth/login',
    parameters: [],
    requestBody: undefined,
    responses: [
      {
        status: '200',
        mediaType: 'application/json',
        schema: { type: 'string', _version: '3.1' } as JsonSchema,
      },
    ],
    ...overrides,
  }
}

function makeAst(op: NormalizedOperation): MethodAst {
  return buildMethodAst(op, makeParserContext({}))
}

const META = {
  title: 'Sample',
  version: '1.0.0',
  openapiVersion: '3.1.0',
}

describe('generateGlobals', () => {
  it('empty operations produces empty interface', () => {
    const out = generateGlobals([], 'Apis', META)
    expect(out).toContain('interface Apis {}')
    expect(out).toContain('var Apis: Apis;')
  })

  it('uses globalName', () => {
    const out = generateGlobals([], 'MyApi', META)
    expect(out).toContain('interface MyApi')
    expect(out).toContain('var MyApi: MyApi;')
  })

  it('contains import statements', () => {
    const out = generateGlobals([], 'Apis', META)
    expect(out).toContain(
      "import type { Alova, AlovaMethodCreateConfig, AlovaGenerics, Method } from 'alova';",
    )
    expect(out).toContain(
      "import type { $$userConfigMap, alovaInstance } from './index';",
    )
    expect(out).toContain("import type apiDefinitions from './apiDefinitions';")
  })

  it('contains Alova2MethodConfig and Alova2Method types', () => {
    const out = generateGlobals([], 'Apis', META)
    expect(out).toContain('type Alova2MethodConfig<Responded>')
    expect(out).toContain('type Alova2Method<')
    // wormhole-style typings use Alova2MethodConfig internally; the demo also
    // uses Alova2MethodConfig as the bound.
    expect(out).toContain('CurrentConfig extends Alova2MethodConfig<any>')
  })

  it('contains the JSDoc and signature for a method', () => {
    const op = makeOp({
      tag: 'user',
      operationId: 'login',
      method: 'post',
      path: '/user/login',
      summary: 'Login user',
    })
    const out = generateGlobals([makeAst(op)], 'Apis', META)
    expect(out).toMatch(
      createStrReg(`/**
       * ---
       * [POST] Login user
       * **path:** /user/login
       * ---
       * **Response**
       * \`\`\`ts
       * type Response = string
       * \`\`\`
       */`),
    )
    expect(out).toMatch(
      createStrReg(
        `login<Config extends Alova2MethodConfig<string>>(config?: Config): Alova2Method<string, 'user.login', Config>;`,
      ),
    )
  })

  it('const discriminator preserves literals', () => {
    const op = makeOp({
      tag: 'auth',
      operationId: 'forgetPassword',
      method: 'post',
      path: '/forget/password',
      responses: [
        {
          status: '200',
          mediaType: 'application/json',
          schema: { type: 'null', _version: '3.1' } as JsonSchema,
        },
      ],
      requestBody: {
        mediaType: 'application/json',
        required: true,
        schema: {
          oneOf: [
            {
              type: 'object',
              properties: {
                channel: { const: 'email', _version: '3.1' } as JsonSchema,
                email: { type: 'string', _version: '3.1' } as JsonSchema,
                password: { type: 'string', _version: '3.1' } as JsonSchema,
                code: { type: 'string', _version: '3.1' } as JsonSchema,
              },
              required: ['channel', 'email', 'password', 'code'],
              _version: '3.1',
            } as JsonSchema,
            {
              type: 'object',
              properties: {
                channel: { const: 'phone', _version: '3.1' } as JsonSchema,
                phone: { type: 'string', _version: '3.1' } as JsonSchema,
                password: { type: 'string', _version: '3.1' } as JsonSchema,
                code: { type: 'string', _version: '3.1' } as JsonSchema,
              },
              required: ['channel', 'phone', 'password', 'code'],
              _version: '3.1',
            } as JsonSchema,
          ],
          _version: '3.1',
        } as JsonSchema,
      },
    })
    const out = generateGlobals([makeAst(op)], 'Apis', META)
    // The 3.0 union becomes a TS union with a `null` literal from the explicit
    // `type: 'null'` schema. pathKey now uses tag.operationId verbatim.
    expect(out).toContain("'auth.forgetPassword'")
    expect(out).toMatch(
      /forgetPassword<Config extends Alova2MethodConfig<null>/,
    )
  })

  it('groups methods by tag', () => {
    const out = generateGlobals(
      [
        makeAst(makeOp({ tag: 'a', operationId: 'one', path: '/a/one' })),
        makeAst(makeOp({ tag: 'b', operationId: 'two', path: '/b/two' })),
      ],
      'Apis',
      META,
    )
    expect(out).toContain('a: {')
    expect(out).toContain('b: {')
    expect(out).toContain('one<')
    expect(out).toContain('two<')
  })

  it('converts hyphenated tag to camelCase identifier', () => {
    // Loader normalizes the tag, but generateGlobals also applies the
    // transformation as a defense-in-depth measure so callers can pass an
    // un-normalized tag and still get a valid interface.
    const out = generateGlobals(
      [
        makeAst(
          makeOp({
            tag: 'admin-config',
            operationId: 'getConfig',
            path: '/admin/config',
          }),
        ),
      ],
      'Apis',
      META,
    )
    expect(out).toContain('adminConfig: {')
    // The raw hyphenated tag must never appear as an interface key.
    expect(out).not.toMatch(/^\s+admin-config:/m)
    // Alova2Method's debug identifier uses the normalized tag.
    expect(out).toContain("'adminConfig.getConfig'")
  })

  it('path params become a separate pathParams field', () => {
    const op = makeOp({
      tag: 'file',
      operationId: 'getFile',
      method: 'get',
      path: '/file/{filename}',
      parameters: [
        {
          name: 'filename',
          in: 'path',
          required: true,
          schema: { type: 'string', _version: '3.0' } as JsonSchema,
        },
      ],
      responses: [],
    })
    const out = generateGlobals([makeAst(op)], 'Apis', META)
    expect(out).toContain('pathParams: { filename: string; }')
    expect(out).not.toContain('data: { filename:')
  })

  it('path / query params with no schema fall back to safe defaults', () => {
    // A schema-less path param falls back to `string` (paths are always
    // strings); a schema-less query param falls back to `unknown`.
    const op = makeOp({
      tag: 'x',
      operationId: 'list',
      method: 'get',
      path: '/items/{id}',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: undefined,
        },
        {
          name: 'q',
          in: 'query',
          required: false,
          schema: undefined,
        },
      ],
      responses: [],
    })
    const out = generateGlobals([makeAst(op)], 'Apis', META)
    expect(out).toContain('pathParams: { id: string; }')
    expect(out).toContain('params: { q?: unknown; }')
  })

  it('header comment is present at top', () => {
    const out = generateGlobals([], 'Apis', META)
    const lines = out.split('\n')
    expect(lines[0]).toBe('/* tslint:disable */')
    expect(lines[1]).toBe('/* eslint-disable */')
    expect(lines[2]).toBe('/**')
    expect(lines[3]).toBe(` * ${META.title} - version ${META.version}`)
    expect(lines[5]).toBe(` * OpenAPI version: ${META.openapiVersion}`)
    expect(out).toContain('https://github.com/seepine/openapi-generator')
    expect(out).toContain('**Do not edit the file manually**')
    expect(out).toContain('**该文件由工具自动生成，请勿手动修改**')
  })

  it('export {}; at end of file', () => {
    const out = generateGlobals([], 'Apis', META)
    expect(out).toContain('export {};')
  })
})
