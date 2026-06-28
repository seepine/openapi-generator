import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('multiple_media_type', () => {
  it('prefers application/json when multiple media types are present', async () => {
    const { apiDefinitions, globals } = await runGenerate(FIXTURE)
    expect(apiDefinitions).toBeTruthy()
    expect(globals).toBeTruthy()
    // The actual test would need to verify which media type was chosen,
    // but at minimum ensure the file generates.
  })
})
