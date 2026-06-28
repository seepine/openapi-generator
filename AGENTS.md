# AGENTS.md

## 简介

一个纯 Node 的 CLI / 库，把 Swagger 2.0 / OpenAPI 3.0 / 3.1 的 JSON 文档编译成 [alova](https://alova.js.org/) 友好的 TypeScript 客户端

```
src/
├── generate.ts          # 公开入口：generate(options)
├── vite.ts              # Vite 插件工厂：openapiGenerator(opts)
├── types.ts             # 中间表示 IR
├── loader/              # readDocument → detectVersion → normalize
├── parser/              # JsonSchema → TsType AST + 打印器
├── generator/           # MethodAst → globals.d.ts + apiDefinitions.ts + JSDoc
├── writer/              # 渲染模板与写盘
└── utils/               # logger / path / strings
```

## 构建 / 测试命令

```sh
pnpm test       # vitest 测试
pnpm coverage   # v8 覆盖率
pnpm tsc        # 类型检查
pnpm build      # 构建 dist
pnpm format     # prettier 格式化
```

## 编码约定

- TypeScript strict、纯 ESM、目标约 ES2024（Node 24）。不要 CJS，不要为兼容老 Node 改编译目标。
- 一个文件一份职责。`parser/parsers/*` 各自只负责 `forward()` 的一个标签。
- 不要 default export（`apiDefinitions.ts` 除外 —— 那是 alova wormhole 约定）。
- 注释解释 **why**；代码本身说明 **what**。`src/parser/` 和 `src/loader/` 每个文件顶部都有一块注释说明它在处理哪个 OpenAPI 特性。
- Prettier 提交时格式化（`prettier.config.ts` 已在）。提交前跑 `pnpm format`。
- 测试放在 `test/`，子目录与 `src/` 对齐。E2E（`generate.test.ts`）用真实 `node:http` 跑 URL 输入；集成（`integration/elysia`）真的拉起 `@elysiajs/openapi` + zod 写的 todo 应用。
- 测试里用 `setLogger` 静音 warn；不要在生产代码里默默吞 warn。

## 做 / 不做

- ✅ 新增 OpenAPI 特性：在 `test/usecases/<name>/` 加 fixture；在 `test/parser/` 写解析器级覆盖；在 `test/generate.test.ts` 加 E2E 覆盖。
- ✅ 新增 JSON-Schema 关键字时同时改 `src/parser/parsers/*` 和 `src/loader/normalize.ts` —— 两层各自有独立测试。
- ✅ 改动 `writer/templates.ts` 时同步更新 README 的产物列表，避免文档漂移。
- ❌ 不要生成 `.prettierignore`。README 及任何面向用户的文档必须明确这一点。
- ❌ 不要在单 op 解析失败时抛错。契约是「跳过 + warn」。
- ❌ 不要把 `format` 映射到 TS 类型（`format: 'date-time' → Date` 等）—— 这是纯类型生成器，Date 是运行时关切。
- ❌ 不要在 `src/index.ts` 加 `default export`。包走具名导出。
- ❌ 不要对 URL 输入做超出 `^https?://` 之外的校验。不要 DNS 探测、不要解析 host —— 让 `fetch` 的错误冒上来。
