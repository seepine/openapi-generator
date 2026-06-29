# openapi-generator

[![codecov][codecov-img]][codecov-href]
[![npm version][npm-version-img]][npm-version-href]
[![npm downloads][npm-downloads-img]][npm-downloads-href]
[![License][license-img]][license-href]

将 OpenAPI JSON 文档，生成适用于 [alova](https://alova.js.org/) 拥有完整的类型提示的 TypeScript 代码

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
  // 或者 input: 'http://localhost:3000/openapi/json',
  outputDir: resolve('./src/api'),
})
```

`src/api/` 下会得到：

```
src/api/
├── apiDefinitions.ts   # 'tag.operationId' → [METHOD, path]
├── globals.d.ts        # declare global { interface Apis { ... } }
├── createApis.ts       # createApis / mountApis / withConfigType
└── index.ts            # alovaInstance + mountApis（不存在则生成，不会重复覆盖）
```

## Vite 插件

### vite.config.ts

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { openapiGenerator } from '@seepine/openapi-generator/vite'

export default defineConfig({
  plugins: [
    openapiGenerator({
      input: 'http://localhost:3000/openapi/json',
      // outputDir: 'src/api',       // 默认 <root>/src/api
      // watch: true,         // 默认vite热重载时监听 input 是否变化，若变化重新生成
      // watchDebounce: 30,   // 默认30秒生成间隔
      // globalName: 'Apis',  // 默认挂载到 window.Apis，可改成任意值
    }),
  ],
})
```

### main.ts

```ts
import './api'
```

### 使用

```ts
Apis.user.login({ data: { username, password } })
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

[codecov-img]: https://codecov.io/gh/seepine/openapi-generator/graph/badge.svg
[codecov-href]: https://codecov.io/gh/seepine/openapi-generator
[npm-version-img]: https://img.shields.io/npm/v/@seepine/openapi-generator
[npm-version-href]: https://www.npmjs.com/package/@seepine/openapi-generator
[npm-downloads-img]: https://img.shields.io/npm/dm/@seepine/openapi-generator
[npm-downloads-href]: https://npmjs.com/package/@seepine/openapi-generator
[license-img]: https://img.shields.io/github/license/seepine/openapi-generator.svg
[license-href]: https://github.com/seepine/openapi-generator/blob/main/LICENSE
