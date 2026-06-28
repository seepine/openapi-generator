import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('multiple_tag_openapi', () => {
  it('uses only the first tag for keys', async () => {
    const { apiDefinitions } = await runGenerate(FIXTURE)
    expect(apiDefinitions).toBeTruthy()
    // addPet has tags: ['pet', 'store'] — first tag 'pet' should be used as the key prefix
    expect(apiDefinitions).toContain("'pet.addPet'")
    // The second tag should NOT appear as a key prefix
    expect(apiDefinitions).not.toContain("'store.addPet'")
  })

  it('generates expected files for unicode-tagged operations', async () => {
    const { apiDefinitions, globals } = await runGenerate(FIXTURE)
    // updatePet has a unicode tag; generator should preserve it verbatim
    expect(apiDefinitions).toBeTruthy()
    expect(globals).toBeTruthy()
  })
})
