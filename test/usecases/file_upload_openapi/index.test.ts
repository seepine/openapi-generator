import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('file_upload_openapi', () => {
  it('formats the binary upload field as Blob (not string / unknown)', async () => {
    const { globals } = await runGenerate(FIXTURE)
    expect(globals).toBeTruthy()
    // The schema declares `type: 'string', format: 'binary'`. The
    // generator surfaces that as the DOM global `Blob` so consumers see
    // a real binary-payload type instead of a stringly-typed hack.
    expect(globals).toContain('file: Blob')
    expect(globals).not.toMatch(/file\?:\s*string/)
    expect(globals).not.toMatch(/file\?:\s*unknown/)
  })
})
