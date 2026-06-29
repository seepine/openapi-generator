/**
 * 真实集成测试：用一个由 `@elysiajs/openapi` + zod 自动生成的 OpenAPI 3.0 文档
 * 作为输入，跑 `generate()`，验证产物符合预期。
 *
 * 工作流程：
 *   1. beforeAll: 跑起 todoApp 在一个临时端口上，generator 通过 HTTP 拉文档。
 *   2. 每个 it: 调用 `runGenerate()`，自动清空 <fixture>/output / 拉取文档 /
 *      读回 4 个文件内容。
 *
 * 与 test/usecases/<name>/ 相同的「product snapshot」布局：output/ 只放生成器
 * 真正产生的产物；input 来自活的 HTTP 端点（URL 模式），不写中间文件。
 *
 * 覆盖范围见 ./todoApp.ts。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { fetchOpenApiJson } from './todoApp'
import { startServer } from './server'
import { generate } from '../../../src/generate'
import { setupOutput, expectAllFiles, type FixtureOutput } from '../../_helper'

const FIXTURE = `${__dirname}`

let baseUrl: string
let closeServer: () => Promise<void>

beforeAll(async () => {
  // Boot the real app: generator will pull the OpenAPI doc from this URL.
  // Running on an ephemeral port keeps parallel test runs from clobbering
  // each other.
  const server = await startServer()
  baseUrl = server.baseUrl
  closeServer = server.close

  // Sanity check: the doc really came from elysia's openapi plugin and the
  // server is reachable from the URL we're about to hand to generate().
  const spec = (await fetchOpenApiJson()) as Record<string, unknown>
  expect(spec).toBeTypeOf('object')
  expect(spec.openapi).toBe('3.0.3')
  expect(spec.paths).toBeTypeOf('object')

  const live = await fetch(baseUrl + '/openapi/json')
  expect(live.ok, `GET ${baseUrl}/openapi/json failed`).toBe(true)
})

afterAll(async () => {
  await closeServer?.()
})

/**
 * Recreate <fixture>/output and run `generate({ input: <live URL>, outputDir })`.
 * Mirrors `runGenerate` from _helper, except the input is the live HTTP server
 * URL rather than a fixture-local openapi.json — and reads back the 4 product
 * files so tests can assert against their strings.
 */
async function runGenerate(): Promise<FixtureOutput> {
  const out = await setupOutput(FIXTURE)
  await generate({ input: baseUrl + '/openapi/json', outputDir: out })
  return expectAllFiles(out)
}

describe('integration: elysia (zod) + @elysiajs/openapi → openapi-generator', () => {
  it('todo app routes are registered (5 CRUD + 1 upload + 1 download + 3 discriminator = 10 ops)', async () => {
    const spec = (await fetchOpenApiJson()) as {
      paths: Record<string, Record<string, unknown>>
    }
    expect(Object.keys(spec.paths['/todos'] ?? {}).sort()).toEqual([
      'get',
      'post',
    ])
    expect(Object.keys(spec.paths['/todos/{id}'] ?? {}).sort()).toEqual([
      'delete',
      'get',
      'patch',
    ])
    expect(spec.paths['/forget/password']?.post).toBeTypeOf('object')
    expect(spec.paths['/oauth/token']?.post).toBeTypeOf('object')
    expect(spec.paths['/integrations/toggle']?.post).toBeTypeOf('object')
    expect(spec.paths['/todos/{id}/attachment']?.post).toBeTypeOf('object')
    expect(spec.paths['/todos/{id}/attachment']?.get).toBeTypeOf('object')
  })

  it('writes all 4 generated files from a real zod-driven OpenAPI doc', async () => {
    const { dir } = await runGenerate()

    for (const name of [
      'apiDefinitions.ts',
      'globals.d.ts',
      'createApis.ts',
      'index.ts',
    ]) {
      const stat = await fs.stat(join(dir, name))
      expect(stat.isFile(), `missing ${name}`).toBe(true)
    }
  })

  it('does not write an openapi.json copy into output (input came from URL, not disk)', async () => {
    // Generator consumes input via HTTP; nothing should land on disk except
    // the 4 product files and `index.ts` when absent.
    const { dir } = await runGenerate()
    await expect(fs.stat(join(dir, 'openapi.json'))).rejects.toThrow()
  })

  it('does not generate .prettierignore (caller-managed)', async () => {
    const { dir } = await runGenerate()
    await expect(fs.stat(join(dir, '.prettierignore'))).rejects.toThrow()
  })

  it('apiDefinitions.ts has one entry per todo operation (CRUD + upload + download + discriminator)', async () => {
    const { apiDefinitions } = await runGenerate()

    // elysia 默认没有 tag，生成器把空 tag 归入 `default` 命名空间，
    // 与 opId 拼成 "<tag>.<opId>"，所以呈现为 "default.getTodos"。
    for (const opId of [
      'getTodos',
      'postTodos',
      'getTodosById',
      'patchTodosById',
      'deleteTodosById',
      'postForgetPassword',
      'postOauthToken',
      'postIntegrationsToggle',
      'postTodosByIdAttachment',
      'getTodosByIdAttachment',
    ]) {
      expect(apiDefinitions).toContain(`'default.${opId}':`)
    }

    expect(apiDefinitions).toContain("'/todos'")
    expect(apiDefinitions).toContain("'/todos/{id}'")
    expect(apiDefinitions).toContain("'/forget/password'")
    expect(apiDefinitions).toContain("'/oauth/token'")
    expect(apiDefinitions).toContain("'/integrations/toggle'")
    expect(apiDefinitions).toContain("'/todos/{id}/attachment'")
    expect(apiDefinitions).toContain("'GET'")
    expect(apiDefinitions).toContain("'POST'")
    expect(apiDefinitions).toContain("'PATCH'")
    expect(apiDefinitions).toContain("'DELETE'")
  })

  it('globals.d.ts exposes all 10 operation methods on the global Apis interface', async () => {
    const { globals } = await runGenerate()

    expect(globals).toContain('interface Apis')
    for (const method of [
      'getTodos',
      'postTodos',
      'getTodosById',
      'patchTodosById',
      'deleteTodosById',
      'postForgetPassword',
      'postOauthToken',
      'postIntegrationsToggle',
      'postTodosByIdAttachment',
      'getTodosByIdAttachment',
    ]) {
      expect(globals).toContain(method)
    }
    expect(globals).toContain('Alova2MethodConfig<')
    expect(globals).toContain('Alova2Method<')
  })

  it('createApis.ts registers Apis on globalThis with the default name', async () => {
    const { createApis } = await runGenerate()
    expect(createApis).toContain('(globalThis as any).Apis = Apis')
  })

  it('index.ts contains the alova mount template', async () => {
    const { index } = await runGenerate()
    expect(index).toContain('alovaInstance')
    expect(index).toContain('baseURL')
    expect(index).toContain('mountApis')
  })

  // ---- const discriminator assertions (mirror const_discriminator_openapi fixture) ----

  it('forgetPassword: const string discriminator (channel=email | phone) is split into 2 branches', async () => {
    const { globals } = await runGenerate()

    // parser 对 oneOf/anyOf 分支独立解析，每个分支的字段都应出现
    expect(globals).toContain("channel: 'email';")
    expect(globals).toContain("channel: 'phone';")
    expect(globals).toContain('email: string;')
    expect(globals).toContain('phone: string;')
    // 两支共有的字段也应出现
    expect(globals).toContain('password: string;')
    expect(globals).toContain('code: string;')
  })

  it('oauthToken: 4 grant_type branches (password / authorization_code / refresh_token / enum) are all present', async () => {
    const { globals } = await runGenerate()

    // const 分支
    expect(globals).toContain("grant_type: 'password';")
    expect(globals).toContain("grant_type: 'authorization_code';")
    expect(globals).toContain("grant_type: 'refresh_token';")

    // enum 分支：parser 把 enum 渲染成 union 字面类型
    expect(globals).toContain(
      "grant_type: 'client_credentials' | 'device_code';",
    )
  })

  it('toggleIntegration: boolean const discriminator (enabled=true | false) is split into 2 branches', async () => {
    const { globals } = await runGenerate()

    expect(globals).toContain('enabled: false;')
    expect(globals).toContain('enabled: true;')

    // true 分支独有的字段。`z.string().url()` 输出 format='uri'，
    // openapi-generator 的 parser 把 `format` 视为纯校验约束 —— TS
    // 没有原生 Uri/Email/Uuid 类型 —— 因此保持 `string`。
    expect(globals).toContain('url: string;')
    expect(globals).toContain('apiKey: string;')
  })

  // ---- binary upload (z.file → format=binary → Blob request body) -------

  it('uploadAttachment: z.file() surfaces as Blob in the data shape, not string', async () => {
    const { globals } = await runGenerate()

    expect(globals).toContain('postTodosByIdAttachment<')
    expect(globals).toContain('data: { filename: string; file: Blob }')
    expect(globals).toContain('filename: string;')
    expect(globals).not.toMatch(/file:\s*string/)
  })

  // ---- binary download (z.file → format=binary → Blob response) --------

  it('downloadAttachment: Blob response stays Blob (response type=format=binary)', async () => {
    const { globals } = await runGenerate()

    // Slice the first 600 chars after the op to scope `Alova2MethodConfig<...>`
    // assertions to this op rather than the whole interface.
    const block = globals.slice(
      globals.indexOf('getTodosByIdAttachment<'),
      globals.indexOf('getTodosByIdAttachment<') + 600,
    )
    expect(block).toMatch(/Alova2MethodConfig<\s*Blob\s*>/)
    expect(block).not.toMatch(/\bAlova2MethodConfig<\s*string\s*>/)
    expect(block).not.toMatch(/\bAlova2MethodConfig<\s*unknown\s*>/)
  })
})
