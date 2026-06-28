import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('endless_loop_openapi', () => {
  it('handles cyclic refs without throwing', async () => {
    const { globals, apiDefinitions } = await runGenerate(FIXTURE)
    expect(globals).toBeTruthy()
    expect(apiDefinitions).toBeTruthy()
  })

  it('produces all 4 expected files', async () => {
    const { apiDefinitions, globals, createApis, index } =
      await runGenerate(FIXTURE)
    expect(apiDefinitions).toContain('addPet')
    expect(globals).toContain('addPet')
    expect(createApis).toBeTruthy()
    expect(index).toContain('alovaInstance')
  })
})
