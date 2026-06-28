# openapi-generator

[![npm version][npm-version-src]][npm-version-href]
[![License][license-src]][license-href]

将 OpenAPI 文档，生成适用于 alova 拥有完整的类型提示的 TypeScript 代码

```ts
// 直接使用
Apis.user.login({ data: { username, password } })
```

## 安装

```sh
pnpm add alova
pnpm add -D @seepine/openapi-generator

# 用 Vite 插件时
pnpm add -D vite
```

## 快速开始

```ts
import { generate } from '@seepine/openapi-generator'
import { resolve } from 'node:path'

await generate({
  input: resolve('./openapi.json'),
  // input: 'http://localhost:3000/openapi/json',
  outputDir: resolve('./src/api'),
})
```

`src/api/` 下会得到：

```
src/api/
├── apiDefinitions.ts   # 'tag.operationId' → [METHOD, path]
├── globals.d.ts        # declare global { interface Apis { ... } }
├── createApis.ts       # createApis / mountApis / withConfigType
└── index.ts            # alovaInstance + mountApis（首次生成后归你）
```

## Vite 插件

### openapiGenerator

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { openapiGenerator } from '@seepine/openapi-generator/vite'

export default defineConfig({
  plugins: [
    openapiGenerator({
      input: 'http://localhost:3000/openapi/json',
      // outputDir 默认 <root>/src/api
      // watch 默认 true：dev 时监听 input 变更自动重新生成
      // watchDebounce 默认生成间隔 30 秒
    }),
  ],
})
```

字段：

- `input` — 必填，同 `generate`。
- `outputDir` — 可选，默认 `<viteRoot>/src/api`。绝对路径直接用，相对路径相对 vite root。
- `globalName` — 可选，同 `generate`。
- `watch` — 可选，默认 `true`。
- `watchDebounce` — 可选，默认 `30` 秒。窗口从 `lastRunAt` 起算 —— **只有真正重生一次才会更新时间戳**。这点很重要，否则恶意触发可以无限延长窗口。

URL 模式下 `buildStart` 会先抓一次 body 缓存，`watchChange` 时再抓并按字节比对，相同就不写盘。

支持的 Vite：`^5 || ^6 || ^7 || ^8`（peerDep）。

## API

### `generate(options)`

```ts
import type { GeneratorConfig } from '@seepine/openapi-generator'

await generate({
  input: '/abs/path/openapi.json', // 或 https://...
  outputDir: '/abs/path/out',
  globalName: 'Apis', // 可省，默认 Apis
})
```

字段：

- `input` — 必填。本地文件用绝对路径，URL 用 `http(s)://`。
- `outputDir` — 必填，绝对路径。目录不存在会自动建（含嵌套）。
- `globalName` — 可选，默认 `Apis`。改这个名，globals.d.ts 里的 interface 跟着变。

## 开发

```sh
pnpm test       # vitest 测试
pnpm coverage   # v8 覆盖率
pnpm tsc        # 类型检查
pnpm build      # 构建 dist
pnpm format     # prettier 格式化
```

## License

MIT © [seepine](https://github.com/seepine)

[npm-version-src]: https://img.shields.io/npm/v/@seepine/openapi-generator
[npm-version-href]: https://www.npmjs.com/package/@seepine/openapi-generator
[license-src]: https://img.shields.io/github/license/seepine/openapi-generator.svg
[license-href]: https://github.com/seepine/openapi-generator/blob/main/LICENSE
