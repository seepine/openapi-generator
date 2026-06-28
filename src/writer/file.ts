import { open, rename, writeFile } from 'node:fs/promises'
import { error } from '../utils/logger'

/**
 * Atomically write `content` to `path`.
 *
 * The write goes through `<path>.tmp` first, then `rename(2)` swaps it into
 * place. `rename` is atomic on POSIX (same filesystem) and on Windows
 * (since Node 14 + Win10), so a crash mid-write leaves either the old
 * contents or the new contents in place — never a half-written file.
 *
 * If `exclusive` is true and the target file already exists, the write is
 * skipped silently (returns `false`). This is the "create only if missing"
 * path used for `index.ts`, which the generator must not overwrite once the
 * user has taken ownership of it.
 *
 * Uses async I/O so the Vite plugin's `watchChange` does not block the
 * event loop while writing 4 generated files.
 *
 * @returns `true` if a file was written, `false` if `exclusive` skipped an
 * existing file.
 */
export async function writeGenerated(
  path: string,
  content: string,
  opts: { exclusive?: boolean } = {},
): Promise<boolean> {
  if (opts.exclusive) {
    const handle = await open(path, 'wx').catch((e) => {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') return undefined
      throw e
    })
    if (!handle) return false
    try {
      await handle.writeFile(content, 'utf-8')
    } finally {
      await handle.close()
    }
    return true
  }

  const tmp = `${path}.tmp`
  try {
    await writeFile(tmp, content, 'utf-8')
    await rename(tmp, path)
  } catch (e) {
    await reportAndThrow(path, e)
  }
  return true
}

async function reportAndThrow(path: string, e: unknown): Promise<never> {
  error(`failed to write ${path}: ${(e as Error).message}`)
  throw e
}
