/**
 * TODO 风格的真实路由集合。
 *
 * 校验完全交给 zod：
 *   - 每个路由的 body / query / params / response 都是 zod schema
 *   - 通过 `@elysiajs/openapi` 的 `mapJsonSchema` 把 zod schema 转 JSON Schema，
 *     然后写入 OpenAPI 文档
 *   - handler 内部 `schema.parse(input)` 做运行时校验（手动 parse，不依赖 elysia 的
 *     默认 TypeBox validator）
 *
 * 覆盖 openapi-generator 在典型 web 后端能遇到的几种形态：
 *   - 基础 CRUD：path / query / body / response、嵌套对象、数组
 *   - nullable、optional、partial
 *   - 二进制上传：`z.file()` 在 OpenAPI 描述里展开为 `type: string, format: binary`，
 *     生成器把它映射成 TS 的 `Blob`，而不是 `string`
 *   - 与 test/usecases/const_discriminator_openapi 对齐的 4 种场景：
 *       1. oneOf + const string discriminator (channel='email' | 'phone')
 *       2. anyOf + const 多分支 (grant_type='password' | 'authorization_code' | 'refresh_token')
 *       3. oneOf + boolean const discriminator (enabled=true | false)
 *       4. 单 const 字段多值 (grant_type='client_credentials' | 'device_code' via enum)
 */
import { Elysia } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { z } from 'zod'

// ---- shared primitives --------------------------------------------------

const Priority = z.union([
  z.literal('low'),
  z.literal('medium'),
  z.literal('high'),
])

const TodoItem = z.object({
  id: z.number(),
  title: z.string(),
  done: z.boolean(),
  priority: Priority,
})

// ---- discriminator schemas (mirror const_discriminator_openapi) ---------

// 1. oneOf + const string discriminator (channel='email' | 'phone')
//    → zod 的 z.discriminatedUnion 输出 zod 的 "discriminated union"，转 JSON Schema
//      后会带 discriminator 字段（plugin 会把它展开成 oneOf）
const ForgetPasswordBody = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('email'),
    email: z.string(),
    password: z.string(),
    code: z.string(),
  }),
  z.object({
    channel: z.literal('phone'),
    phone: z.string(),
    password: z.string(),
    code: z.string(),
  }),
])

// 2. anyOf + const 多分支 (grant_type 多分支) — 用 z.union，JSON Schema 是 anyOf
//    注意：openapi-generator 的 parser 对 union 分支**独立解析**，
//    所以 zod 端合并/不合并只是运行时校验的事，产物行为一致
const OAuthTokenBody = z.union([
  z.object({
    grant_type: z.literal('password'),
    username: z.string(),
    password: z.string(),
    scope: z.string().optional(),
  }),
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string(),
    redirect_uri: z.string().url(),
    client_id: z.string(),
    client_secret: z.string(),
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string(),
  }),
  // 4. 单字段多值（enum 而非 const 自身）— 放在同一个 union 里，产物仍然是独立分支
  z.object({
    grant_type: z.enum(['client_credentials', 'device_code']),
    scope: z.string().optional(),
  }),
])

// 3. oneOf + boolean const discriminator (enabled=true | false)
const ToggleIntegrationBody = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    url: z.string().url(),
    apiKey: z.string().min(1),
  }),
])

// ---- helpers (handler 内部运行时校验) ---------------------------------
const QueryList = z.object({
  q: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
})
const ParamsId = z.object({ id: z.string() })
const CreateTodo = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  priority: Priority,
})
const PatchTodoBody = z
  .object({
    title: z.string().optional(),
    done: z.boolean().optional(),
    priority: Priority.optional(),
  })
  .partial()
const PatchTodoResponse = z
  .object({
    id: z.number(),
    title: z.string().optional(),
    done: z.boolean().optional(),
    priority: Priority.optional(),
  })
  .partial()

// zod 4 的 z.file() 映射到 OpenAPI 的 `type: string, format: binary`，
// generator 应该把它读作 TS 的 Blob。
const UploadAttachmentBody = z.object({
  filename: z.string().min(1),
  file: z.file(),
})

// ---- app ----------------------------------------------------------------

export const todoApp = new Elysia({ name: 'todo-app' })
  .use(
    openapi({
      path: '/openapi',
      mapJsonSchema: {
        // zod 4 自带 toJSONSchema；plugin 在遇到 ~standard.vendor === 'zod' 的
        // schema 时会调这个函数把 zod → JSON Schema，再写进 OpenAPI 文档。
        // 注意：zod 3 用的是 zod-to-json-schema，是另一个包。
        zod: z.toJSONSchema,
      },
    }),
  )
  // ---- CRUD: list / get / create / patch / delete -----------------------
  .get(
    '/todos',
    ({ query }) => {
      const q = QueryList.parse(query)
      return {
        items: [
          { id: 1, title: 'first', done: false, priority: 'low' as const },
          { id: 2, title: 'second', done: true, priority: 'high' as const },
        ],
        total: 2,
        q: q.q ?? '',
      }
    },
    {
      query: QueryList,
      response: z.object({
        items: z.array(TodoItem),
        total: z.number(),
        q: z.string(),
      }),
    },
  )
  .get(
    '/todos/:id',
    ({ params }) => {
      const { id } = ParamsId.parse(params)
      return {
        id: Number(id),
        title: `todo-${id}`,
        done: false,
        priority: 'medium' as const,
      }
    },
    {
      params: ParamsId,
      response: TodoItem,
    },
  )
  .post(
    '/todos',
    ({ body }) => {
      // zod 解析运行时校验
      const data = CreateTodo.parse(body)
      return { id: Math.floor(Math.random() * 100000), ...data }
    },
    {
      body: CreateTodo,
      response: z.object({
        id: z.number(),
        title: z.string(),
        description: z.string().nullable(),
        priority: Priority,
      }),
    },
  )
  .patch(
    '/todos/:id',
    ({ params, body }) => {
      const { id } = ParamsId.parse(params)
      return { id: Number(id), ...PatchTodoBody.parse(body) }
    },
    {
      params: ParamsId,
      body: PatchTodoBody,
      response: PatchTodoResponse,
    },
  )
  .delete(
    '/todos/:id',
    ({ params }) => {
      const { id } = ParamsId.parse(params)
      return { ok: true as const, id: Number(id) }
    },
    {
      params: ParamsId,
      response: z.object({
        ok: z.literal(true),
        id: z.number(),
      }),
    },
  )
  // ---- discriminator scenarios (mirror const_discriminator_openapi) -----
  .post('/forget/password', ({ body }) => ForgetPasswordBody.parse(body), {
    body: ForgetPasswordBody,
    detail: {
      summary: 'Forget password',
      description: 'oneOf + const channel discriminator',
    },
  })
  .post('/oauth/token', ({ body }) => OAuthTokenBody.parse(body), {
    body: OAuthTokenBody,
    detail: {
      summary: 'OAuth token',
      description: 'anyOf + const grant_type discriminator (4 branches)',
    },
  })
  .post(
    '/integrations/toggle',
    ({ body }) => ToggleIntegrationBody.parse(body),
    {
      body: ToggleIntegrationBody,
      detail: {
        summary: 'Toggle integration',
        description: 'oneOf + boolean const enabled discriminator',
      },
    },
  )
  // ---- binary upload (z.file → format=binary → Blob) ---------------------
  .post(
    '/todos/:id/attachment',
    ({ params, body }) => {
      const { id } = ParamsId.parse(params)
      const data = UploadAttachmentBody.parse(body)
      return {
        id: Number(id),
        filename: data.filename,
        size: data.file.size,
      }
    },
    {
      parse: 'multipart/form-data',
      params: ParamsId,
      body: UploadAttachmentBody,
      response: z.object({
        id: z.number(),
        filename: z.string(),
        size: z.number(),
      }),
      detail: {
        summary: 'Upload a binary attachment to a todo',
        description: 'z.file() → OpenAPI format=binary → TS Blob',
      },
    },
  )
  // ---- binary download (Blob response) ----------------------------------
  .get(
    '/todos/:id/attachment',
    ({ params }) => {
      const { id } = ParamsId.parse(params)
      // elysia forces content-type to application/octet-stream when the
      // response is z.file(); the handler returns a `File` to satisfy it.
      return new File([`todo-${id}`], `todo-${id}.txt`, {
        type: 'text/plain',
      })
    },
    {
      params: ParamsId,
      response: z.file(),
      detail: {
        summary: 'Download the binary attachment for a todo',
        description: 'Blob response → OpenAPI format=binary → TS Blob',
      },
    },
  )

/**
 * Fetch the OpenAPI document from the in-memory app.
 * Mirrors what `GET http://localhost/openapi/json` would return when the app is listening.
 */
export async function fetchOpenApiJson(): Promise<unknown> {
  const res = await todoApp.handle(new Request('http://localhost/openapi/json'))
  if (!res.ok) {
    throw new Error(`openapi endpoint returned HTTP ${res.status}`)
  }
  return res.json()
}
