# Contributing

Thanks for your interest in contributing to `@seepine/openapi-generator`!

## Project overview

A pure Node CLI / library that compiles Swagger 2.0 / OpenAPI 3.0 / OpenAPI 3.1 JSON documents into an [alova](https://alova.js.org/)-friendly TypeScript client.

```
src/
├── generate.ts          # public entry: generate(options)
├── vite.ts              # Vite plugin factory: openapiGenerator(opts)
├── types.ts             # intermediate representation (IR)
├── loader/              # readDocument → detectVersion → normalize
├── parser/              # JsonSchema → TsType AST + printers
├── generator/           # MethodAst → globals.d.ts + apiDefinitions.ts + JSDoc
├── writer/              # render templates + write to disk
└── utils/               # logger / path / strings
```

## Setup

```sh
pnpm install
```

Requires Node ≥ 24 (CI uses Node 24; `engines.node` will track the minimum we actually need).

## Commands

```sh
pnpm test       # vitest
pnpm coverage   # v8 coverage
pnpm tsc        # type check (strict)
pnpm build      # build dist via tsdown
pnpm format     # prettier write
```

## Coding conventions

- TypeScript `strict`, pure ESM, target ≈ ES2024 (Node 24). Do not emit CJS, do not lower the target for older Node.
- One responsibility per file. `parser/parsers/*` each handle exactly one `forward()` tag.
- No default exports (except `apiDefinitions.ts` — that's the alova wormhole convention).
- Comments explain **why**; code shows **what**. Every file under `src/parser/` and `src/loader/` carries a top-of-file comment naming the OpenAPI / JSON-Schema feature it handles.
- Run `pnpm format` before committing — `prettier.config.ts` is the source of truth.
- Tests live under `test/`, mirroring `src/`. E2E (`generate.test.ts`) uses real `node:http` for URL inputs; integration (`integration/elysia`) boots a real `@elysiajs/openapi` + zod todo app.
- In tests, use `setLogger` to silence expected `warn`s — never silently swallow warnings in production code.

## Do / Don't

**Do:**

- Adding an OpenAPI feature → drop a fixture under `test/usecases/<name>/`, add parser-level coverage in `test/parser/`, add E2E coverage in `test/generate.test.ts`.
- Adding a JSON-Schema keyword → update both `src/parser/parsers/*` and `src/loader/normalize.ts`. The two layers have independent tests.
- Touching `writer/templates.ts` → update the generated-files list in `README.md` in the same PR so docs don't drift.

**Don't:**

- Generate a `.prettierignore`. `README.md` and any user-facing docs must call this out explicitly.
- Throw on a single operation's parse failure. Contract is "skip + warn".
- Map `format` to a TS type (e.g. `format: 'date-time' → Date`). This is a pure type generator; `Date` is a runtime concern.
- Add a `default export` to `src/index.ts`. The package uses named exports.
- Validate URL inputs beyond `^https?://`. No DNS probing, no host parsing — let `fetch` errors bubble up.

## Commit messages

This repo enforces [Conventional Commits](https://www.conventionalcommits.org/) via `commitlint` + `simple-git-hooks`. Allowed types:

- `feat:` — new user-facing functionality
- `fix:` — bug fix
- `refactor:` — neither feature nor fix
- `perf:` — performance improvement
- `chore:` — tooling, deps, build (hidden from CHANGELOG)
- `docs:` — docs only (hidden from CHANGELOG)
- `test:` — tests only (hidden from CHANGELOG)
- `style:` — formatting only (hidden from CHANGELOG)

Subject line ≤ 72 chars, imperative mood, no trailing period. Optional scope: `feat(parser): ...`, `fix(vite): ...`.

## Pull requests

1. Fork & branch from `main`.
2. Make your change with tests (see "Do / Don't" above for where to add fixtures).
3. `pnpm tsc && pnpm test && pnpm coverage` must pass locally.
4. `pnpm format` before pushing.
5. Open the PR against `main`. CI (`.github/workflows/check.yml`) runs `tsc`, `test`, `coverage`, `build` on every PR.
6. Squash-merge once approved. A maintainer will run `pnpm release` to cut the next version.

## Releasing

Maintainers only. Process:

```sh
pnpm test            # final gate
pnpm commit-and-tag-version    # bumps version, regenerates CHANGELOG, tags
```

`.github/workflows/publish.yml` picks up `v*` tags and runs the same checks plus `npm publish` with provenance.

## Questions?

Open a GitHub issue. For security issues, see [SECURITY.md](./SECURITY.md).
