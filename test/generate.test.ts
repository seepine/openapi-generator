import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { generate } from '../src/generate'
import { createStrReg } from './_helper'

let tmpRoot: string
let tmp: string
let inputDir: string

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(join(tmpdir(), 'openapi-gen-e2e-'))
  tmp = join(tmpRoot, 'output')
  inputDir = join(tmpRoot, 'input')
  await fs.mkdir(inputDir, { recursive: true })
})
afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

const SAMPLE_OPENAPI = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0' },
  paths: {
    '/login': {
      post: {
        operationId: 'login',
        tags: ['auth'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                  },
                  required: ['token'],
                },
              },
            },
          },
        },
      },
    },
  },
}

async function writeSample(
  filename = 'openapi.json',
  patch: Record<string, unknown> = {},
): Promise<string> {
  const content = JSON.stringify({ ...SAMPLE_OPENAPI, ...patch }, null, 2)
  const p = join(inputDir, filename)
  await fs.writeFile(p, content, 'utf-8')
  return p
}

describe('generate', () => {
  it('writes 4 files to outputDir', async () => {
    const input = await writeSample()
    await generate({ input, outputDir: tmp })

    const apiDefs = await fs.readFile(join(tmp, 'apiDefinitions.ts'), 'utf-8')
    const globals = await fs.readFile(join(tmp, 'globals.d.ts'), 'utf-8')
    const createApis = await fs.readFile(join(tmp, 'createApis.ts'), 'utf-8')
    const index = await fs.readFile(join(tmp, 'index.ts'), 'utf-8')

    expect(apiDefs.length).toBeGreaterThan(0)
    expect(globals.length).toBeGreaterThan(0)
    expect(createApis.length).toBeGreaterThan(0)
    expect(index.length).toBeGreaterThan(0)
  })

  it('apiDefinitions.ts contains the operation key', async () => {
    const input = await writeSample()
    await generate({ input, outputDir: tmp })
    const content = await fs.readFile(join(tmp, 'apiDefinitions.ts'), 'utf-8')
    expect(content).toContain("  'auth.login': ['POST', '/login']")
  })

  it('globals.d.ts contains the method signature', async () => {
    const input = await writeSample()
    await generate({ input, outputDir: tmp })
    const content = await fs.readFile(join(tmp, 'globals.d.ts'), 'utf-8')
    expect(content).toContain('interface Apis')
    expect(content).toContain('auth: {')
    // Prettier splits `<Config extends ...>` onto its own line, so the needle
    // must include the break explicitly (the whitespace-tolerant helper
    // matches both single-space and newline runs).
    expect(content).toMatch(createStrReg('login< Config extends'))
    expect(content).toContain('Alova2MethodConfig<')
    expect(content).toContain('Alova2Method<')
    expect(content).toContain("'auth.login'")
  })

  it('createApis.ts uses Apis default', async () => {
    const input = await writeSample()
    await generate({ input, outputDir: tmp })
    const content = await fs.readFile(join(tmp, 'createApis.ts'), 'utf-8')
    expect(content).toContain('(globalThis as any).Apis = Apis')
    expect(content).not.toContain('ConstDiscriminatedUnion')
  })

  it('createApis.ts + globals.d.ts use custom globalName', async () => {
    const input = await writeSample()
    await generate({ input, outputDir: tmp, globalName: 'MyApis' })
    const createApisContent = await fs.readFile(
      join(tmp, 'createApis.ts'),
      'utf-8',
    )
    const globalsContent = await fs.readFile(join(tmp, 'globals.d.ts'), 'utf-8')
    expect(createApisContent).toContain('(globalThis as any).MyApis = MyApis')
    expect(createApisContent).not.toContain('(globalThis as any).Apis = Apis')
    expect(globalsContent).toContain('interface MyApis')
    // The project's prettier config sets `semi: false`, so the trailing
    // `;` after `var MyApis: MyApis` is dropped during formatting.
    expect(globalsContent).toMatch(createStrReg('var MyApis: MyApis'))
  })

  it('index.ts uses the baseURL/alovaInstance template', async () => {
    const input = await writeSample()
    await generate({ input, outputDir: tmp })
    const content = await fs.readFile(join(tmp, 'index.ts'), 'utf-8')
    expect(content).toContain('baseURL')
    expect(content).toContain('alovaInstance')
    expect(content).toContain('createApis')
    expect(content).toContain('mountApis')
  })

  it('index.ts is not overwritten if it already exists', async () => {
    const input = await writeSample()
    await fs.mkdir(tmp, { recursive: true })
    const customIndex = '// custom user index'
    await fs.writeFile(join(tmp, 'index.ts'), customIndex, 'utf-8')
    await generate({ input, outputDir: tmp })
    const content = await fs.readFile(join(tmp, 'index.ts'), 'utf-8')
    expect(content).toBe(customIndex)
  })

  it('does not generate a .prettierignore (caller manages project-level ignore)', async () => {
    const input = await writeSample()
    await generate({ input, outputDir: tmp })
    await expect(fs.stat(join(tmp, '.prettierignore'))).rejects.toThrow()
  })

  it('skips operations without operationId and continues', async () => {
    const input = await writeSample('openapi.json', {
      paths: {
        '/a': {
          get: {
            tags: ['x'],
            responses: {
              '200': {
                content: { 'application/json': { schema: { type: 'string' } } },
              },
            },
          },
        },
        '/b': {
          get: {
            operationId: 'hasId',
            tags: ['x'],
            responses: {
              '200': {
                content: { 'application/json': { schema: { type: 'string' } } },
              },
            },
          },
        },
      },
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await generate({ input, outputDir: tmp })
    const content = await fs.readFile(join(tmp, 'apiDefinitions.ts'), 'utf-8')
    expect(content).toContain("  'x.hasId': ['GET', '/b']")
    expect(content).not.toContain('"/a":["GET"')

    const messages = warnSpy.mock.calls.map((c) => String(c[0]))
    expect(
      messages.some(
        (m) =>
          m.includes('skip operation without operationId') &&
          m.includes('GET') &&
          m.includes('/a'),
      ),
    ).toBe(true)
    warnSpy.mockRestore()
  })

  it('throws when input file does not exist', async () => {
    await expect(
      generate({
        input: join(tmpRoot, 'does-not-exist.json'),
        outputDir: tmp,
      }),
    ).rejects.toThrow()
  })

  it('throws when OpenAPI doc is missing paths', async () => {
    const p = join(inputDir, 'broken.json')
    await fs.writeFile(
      p,
      JSON.stringify({ openapi: '3.0.0', info: {} }),
      'utf-8',
    )
    await expect(generate({ input: p, outputDir: tmp })).rejects.toThrow()
  })

  it('throws when input is not valid JSON', async () => {
    const p = join(inputDir, 'broken.json')
    await fs.writeFile(p, 'not json', 'utf-8')
    await expect(generate({ input: p, outputDir: tmp })).rejects.toThrow()
  })

  it('throws when input is not an absolute path', async () => {
    await expect(
      generate({ input: 'relative.json', outputDir: tmp }),
    ).rejects.toThrow(/input must be absolute path/)
  })

  it('throws when outputDir is not an absolute path', async () => {
    const input = await writeSample()
    await expect(generate({ input, outputDir: 'relative' })).rejects.toThrow(
      /outputDir must be absolute path/,
    )
  })

  it('creates outputDir if missing (including nested)', async () => {
    const input = await writeSample()
    const nested = join(tmpRoot, 'nested', 'sub', 'output')
    await generate({ input, outputDir: nested })
    const stat = await fs.stat(join(nested, 'apiDefinitions.ts'))
    expect(stat.isFile()).toBe(true)
  })

  it('processes Swagger 2.0 doc', async () => {
    const swagger2 = {
      swagger: '2.0',
      info: { title: 'S2', version: '1.0' },
      paths: {
        '/login': {
          post: {
            operationId: 'login',
            tags: ['auth'],
            parameters: [
              {
                name: 'body',
                in: 'body',
                required: true,
                schema: {
                  type: 'object',
                  properties: { username: { type: 'string' } },
                  required: ['username'],
                },
              },
            ],
            responses: {
              '200': { schema: { type: 'string' } },
            },
          },
        },
      },
    }
    const p = join(inputDir, 'swagger2.json')
    await fs.writeFile(p, JSON.stringify(swagger2), 'utf-8')
    await generate({ input: p, outputDir: tmp })
    const content = await fs.readFile(join(tmp, 'apiDefinitions.ts'), 'utf-8')
    expect(content).toContain("  'auth.login': ['POST', '/login']")
  })

  describe('input as URL', () => {
    let server: Server
    let baseUrl: string

    beforeAll(async () => {
      server = createServer((req, res) => {
        if (req.url === '/spec.json') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify(SAMPLE_OPENAPI))
          return
        }
        res.writeHead(404)
        res.end()
      })
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', () => resolve()),
      )
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`
      } else {
        throw new Error('failed to bind test server')
      }
    })

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    it('fetches the OpenAPI doc via http and writes the 4 generated files', async () => {
      await generate({ input: `${baseUrl}/spec.json`, outputDir: tmp })

      const apiDefs = await fs.readFile(join(tmp, 'apiDefinitions.ts'), 'utf-8')
      expect(apiDefs).toContain("  'auth.login': ['POST', '/login']")
    })

    it('throws a descriptive error when the URL returns a non-2xx status', async () => {
      await expect(
        generate({ input: `${baseUrl}/missing.json`, outputDir: tmp }),
      ).rejects.toThrow(/Failed to fetch OpenAPI document .* HTTP 404/)
    })

    it('does NOT require absolute path when input is a URL', async () => {
      // explicitly pass a relative-looking-but-URL value; the absolute-path
      // assertion must be skipped for URLs
      await generate({ input: `${baseUrl}/spec.json`, outputDir: tmp })
      const apiDefs = await fs.readFile(join(tmp, 'apiDefinitions.ts'), 'utf-8')
      expect(apiDefs.length).toBeGreaterThan(0)
    })
  })
})
