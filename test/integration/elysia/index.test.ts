/**
 * 真实集成测试：用一个由 `@elysiajs/openapi` + zod 自动生成的 OpenAPI 3.0 文档
 * 作为输入，跑 `generate()`，验证产物符合预期。
 *
 * 工作流程：
 *   1. beforeAll: 调用 todoApp.handle() 拿一次 OpenJSON，落到 tmp/openapi.json。
 *      路由校验全部用 zod（z.toJSONSchema → JSON Schema → OpenAPI doc）。
 *   2. 每个 it: 调用 generate({ input: <abs path>, outputDir: <tmp> })，断言产物。
 *
 * 覆盖范围：
 *   - 基础 CRUD（path / query / body / response、嵌套对象、nullable、partial）
 *   - 4 种 const discriminator 场景（mirror test/usecases/const_discriminator_openapi）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchOpenApiJson } from './todoApp'
import { generate } from '../../../src/generate'

let tmpRoot: string
let inputFile: string
let outputDir: string

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(join(tmpdir(), 'openapi-gen-elysia-'))
  inputFile = join(tmpRoot, 'openapi.json')
  outputDir = join(tmpRoot, 'output')

  const spec = await fetchOpenApiJson()
  // Sanity check: the doc really came from elysia's openapi plugin
  expect(spec).toBeTypeOf('object')
  const obj = spec as Record<string, unknown>
  expect(obj.openapi).toBe('3.0.3')
  expect(obj.paths).toBeTypeOf('object')

  await fs.writeFile(inputFile, JSON.stringify(spec, null, 2), 'utf-8')
})

describe('integration: elysia (zod) + @elysiajs/openapi → openapi-generator', () => {
  it('todo app routes are registered (5 CRUD + 3 discriminator = 8 ops)', async () => {
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
  })

  it('writes all 4 generated files from a real zod-driven OpenAPI doc', async () => {
    await generate({ input: inputFile, outputDir })

    for (const name of [
      'apiDefinitions.ts',
      'globals.d.ts',
      'createApis.ts',
      'index.ts',
    ]) {
      const stat = await fs.stat(join(outputDir, name))
      expect(stat.isFile(), `missing ${name}`).toBe(true)
    }
  })

  it('does not generate .prettierignore (caller-managed)', async () => {
    await generate({ input: inputFile, outputDir })
    await expect(fs.stat(join(outputDir, '.prettierignore'))).rejects.toThrow()
  })

  it('apiDefinitions.ts has one entry per todo operation (GET/POST/PATCH/DELETE × 5)', async () => {
    await generate({ input: inputFile, outputDir })
    const apiDefs = await fs.readFile(
      join(outputDir, 'apiDefinitions.ts'),
      'utf-8',
    )

    // elysia 默认没有 tag，生成器把 tag 折叠为 '' 并与 opId 拼成 "<tag>.<opId>"
    // 当 tag 为空时呈现为 ".getTodos"（前导点表示空 tag 段）
    for (const opId of [
      'getTodos',
      'postTodos',
      'getTodosById',
      'patchTodosById',
      'deleteTodosById',
      'postForgetPassword',
      'postOauthToken',
      'postIntegrationsToggle',
    ]) {
      expect(apiDefs).toContain(`'.${opId}':`)
    }

    expect(apiDefs).toContain("'/todos'")
    expect(apiDefs).toContain("'/todos/{id}'")
    expect(apiDefs).toContain("'/forget/password'")
    expect(apiDefs).toContain("'/oauth/token'")
    expect(apiDefs).toContain("'/integrations/toggle'")
    expect(apiDefs).toContain("'GET'")
    expect(apiDefs).toContain("'POST'")
    expect(apiDefs).toContain("'PATCH'")
    expect(apiDefs).toContain("'DELETE'")
  })

  it('globals.d.ts exposes all 8 operation methods on the global Apis interface', async () => {
    await generate({ input: inputFile, outputDir })
    const globals = await fs.readFile(join(outputDir, 'globals.d.ts'), 'utf-8')

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
    ]) {
      expect(globals).toContain(method)
    }
    expect(globals).toContain('Alova2MethodConfig<')
    expect(globals).toContain('Alova2Method<')
  })

  it('createApis.ts registers Apis on globalThis with the default name', async () => {
    await generate({ input: inputFile, outputDir })
    const createApis = await fs.readFile(
      join(outputDir, 'createApis.ts'),
      'utf-8',
    )
    expect(createApis).toContain('(globalThis as any).Apis = Apis')
  })

  it('index.ts contains the alova mount template', async () => {
    await generate({ input: inputFile, outputDir })
    const index = await fs.readFile(join(outputDir, 'index.ts'), 'utf-8')
    expect(index).toContain('alovaInstance')
    expect(index).toContain('baseURL')
    expect(index).toContain('mountApis')
  })

  // ---- const discriminator assertions (mirror const_discriminator_openapi fixture) ----

  it('forgetPassword: const string discriminator (channel=email | phone) is split into 2 branches', async () => {
    await generate({ input: inputFile, outputDir })
    const globals = await fs.readFile(join(outputDir, 'globals.d.ts'), 'utf-8')

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
    await generate({ input: inputFile, outputDir })
    const globals = await fs.readFile(join(outputDir, 'globals.d.ts'), 'utf-8')

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
    await generate({ input: inputFile, outputDir })
    const globals = await fs.readFile(join(outputDir, 'globals.d.ts'), 'utf-8')

    expect(globals).toContain('enabled: false;')
    expect(globals).toContain('enabled: true;')

    // true 分支独有的字段。`z.string().url()` 输出 format='uri'，
    // openapi-generator 的 parser 把 `format` 视为纯校验约束 —— TS
    // 没有原生 Uri/Email/Uuid 类型 —— 因此保持 `string`。
    expect(globals).toContain('url: string;')
    expect(globals).toContain('apiKey: string;')
  })
})
