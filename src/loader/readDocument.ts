import { isUrl } from '@/utils/is'
import { readFile } from 'node:fs/promises'

export async function readDocument(input: string): Promise<unknown> {
  const raw = isUrl(input)
    ? await fetchAsText(input)
    : await readFileAsText(input)
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(
      `Failed to parse OpenAPI document at ${input}: ${(e as Error).message}`,
    )
  }
}

async function readFileAsText(absPath: string): Promise<string> {
  try {
    return await readFile(absPath, 'utf-8')
  } catch (e) {
    throw new Error(
      `Failed to read OpenAPI document at ${absPath}: ${(e as Error).message}`,
    )
  }
}

/**
 * Fetch a URL and return its body as text. Throws on network or HTTP
 * failures so callers decide whether to surface or swallow.
 *
 * Exported so the Vite plugin (`src/vite.ts`) reuses the same fetch +
 * error-wrapping logic for its content-cache compare — keeping fetch
 * semantics in one place avoids drift between plugin and loader.
 */
export async function fetchAsText(url: string): Promise<string> {
  // globalThis.fetch is provided by Node >= 18. Types are deliberately
  // loose to avoid pulling the DOM lib into the project.
  const fetcher = (
    globalThis as { fetch?: (input: string) => Promise<ResponseLike> }
  ).fetch
  if (typeof fetcher !== 'function') {
    throw new Error(
      `Failed to fetch OpenAPI document at ${url}: global fetch() is not available (requires Node >= 18)`,
    )
  }
  let res: ResponseLike
  try {
    res = await fetcher(url)
  } catch (e) {
    throw new Error(
      `Failed to fetch OpenAPI document at ${url}: ${(e as Error).message}`,
    )
  }
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenAPI document at ${url}: HTTP ${res.status} ${res.statusText}`,
    )
  }
  return res.text()
}

interface ResponseLike {
  ok: boolean
  status: number
  statusText: string
  text(): Promise<string>
}
