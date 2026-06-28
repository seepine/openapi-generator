import { promises as fs } from 'node:fs'
import { isAbsolute } from 'node:path'

export function assertAbsolute(p: string, name: string): void {
  if (!isAbsolute(p)) {
    throw new Error(`${name} must be absolute path: ${p}`)
  }
}

export async function ensureDir(absPath: string): Promise<void> {
  await fs.mkdir(absPath, { recursive: true })
}
