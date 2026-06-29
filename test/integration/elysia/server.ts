/**
 * HTTP lifecycle for the integration test.
 *
 * The Elysia app (in `./todoApp`) is independent of any HTTP server; this
 * file is what spins up a tiny `node:http` shim, forwards every request
 * through `todoApp.handle(Request)`, and tears the server down afterwards.
 *
 * Kept separate from `todoApp.ts` because it is test infrastructure, not part
 * of the demo app: integration tests own the wiring, the app stays pure and
 * reusable.
 */
import { createServer, type Server } from 'node:http'
import { todoApp } from './todoApp'

export interface TestServer {
  /** `http://127.0.0.1:<port>` — never an Internet host. */
  baseUrl: string
  close(): Promise<void>
}

/**
 * Start the todo app on a free ephemeral port.
 *
 *   const s = await startServer()
 *   // pass s.baseUrl + '/openapi/json' to generate(...)
 *   await s.close()
 */
export async function startServer(): Promise<TestServer> {
  // Hand-rolled http shim: avoids depending on whatever `elysia.listen()`
  // returns in the current major (the shape has churned across versions),
  // and keeps the test wiring local to the test layer.
  const server: Server = createServer((req, res) => {
    const url = req.url ?? '/'
    todoApp
      .handle(new Request(`http://localhost${url}`, { method: req.method }))
      .then((r) => {
        res.writeHead(r.status, Object.fromEntries(r.headers.entries()))
        return r.arrayBuffer()
      })
      .then((buf) => {
        res.end(Buffer.from(buf))
      })
      .catch((err: unknown) => {
        res.writeHead(500, { 'content-type': 'text/plain' })
        res.end(String(err))
      })
  })

  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  )
  const addr = server.address()
  if (!addr || typeof addr !== 'object') {
    throw new Error('failed to bind test server')
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`

  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      }),
  }
}
