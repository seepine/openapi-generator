import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('file_upload_openapi', () => {
  it('generates files (binary format stays as string, not unknown)', async () => {
    const { globals } = await runGenerate(FIXTURE)
    expect(globals).toBeTruthy()
    // `format: binary` is a validation hint — TS has no native binary type,
    // so it stays as `string` rather than collapsing to `unknown`.
    // The generator is type-only and does not enforce serialization.
    expect(globals).not.toMatch(/file\?:\s*unknown/)
  })
})
