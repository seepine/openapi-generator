import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setLogger } from '../../src/utils/logger'
import { writeGenerated } from '../../src/writer/file'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'openapi-gen-writer-'))
})

afterEach(() => {
  setLogger({})
})

describe('writeGenerated', () => {
  it('writes the file when target does not exist', async () => {
    const target = join(dir, 'out.ts')
    const ok = await writeGenerated(target, 'hello')
    expect(ok).toBe(true)
    expect(await readFile(target, 'utf-8')).toBe('hello')
  })

  it('overwrites an existing file (non-exclusive)', async () => {
    const target = join(dir, 'out.ts')
    await writeFile(target, 'old', 'utf-8')
    const ok = await writeGenerated(target, 'new')
    expect(ok).toBe(true)
    expect(await readFile(target, 'utf-8')).toBe('new')
  })

  it('does not leave a .tmp file behind on success', async () => {
    const target = join(dir, 'out.ts')
    await writeGenerated(target, 'content')
    expect(existsSync(`${target}.tmp`)).toBe(false)
    expect(existsSync(target)).toBe(true)
  })

  it('skips silently when exclusive and file already exists', async () => {
    const target = join(dir, 'out.ts')
    await writeFile(target, 'user-owned', 'utf-8')
    const ok = await writeGenerated(target, 'generator-owned', {
      exclusive: true,
    })
    expect(ok).toBe(false)
    // Existing content must be preserved exactly — no clobber.
    expect(await readFile(target, 'utf-8')).toBe('user-owned')
  })

  it('writes when exclusive and file does not exist', async () => {
    const target = join(dir, 'out.ts')
    const ok = await writeGenerated(target, 'first', { exclusive: true })
    expect(ok).toBe(true)
    expect(await readFile(target, 'utf-8')).toBe('first')
  })

  it('propagates write errors with a generator-prefixed log line', async () => {
    const logs: string[] = []
    setLogger({ error: (m) => logs.push(m) })
    // Point at a path inside a non-existent directory.
    const target = join(dir, 'nope', 'nested', 'out.ts')
    await expect(writeGenerated(target, 'x')).rejects.toThrow()
    expect(logs.length).toBe(1)
    expect(logs[0]).toContain('failed to write')
    expect(logs[0]).toContain(target)
  })

  it('produces a file with a non-zero size for non-empty content', async () => {
    const target = join(dir, 'out.ts')
    await writeGenerated(target, 'x'.repeat(1024))
    const st = await stat(target)
    expect(st.size).toBe(1024)
  })
})
