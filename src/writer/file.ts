import { open, rename, writeFile } from 'node:fs/promises'
import { error } from '../utils/logger'

/**
 * Atomically write `content` to `path`. Writes go through `<path>.tmp`
 * first, then `rename(2)` swaps into place; rename is atomic on POSIX and
 * Windows (Node 14+ / Win10), so a crash mid-write leaves either the old
 * or new file — never a half-written one.
 *
 * If `exclusive` is true and the target exists, the write is skipped
 * silently (returns `false`). Used for `index.ts`, which the generator must
 * not overwrite once the user has taken ownership.
 *
 * @returns `true` if a file was written, `false` if `exclusive` skipped.
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
    error(`failed to write ${path}: ${(e as Error).message}`)
    throw e
  }
  return true
}
