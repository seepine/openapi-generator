import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('tag_general_openapi', () => {
  it('handles general tag scenarios', async () => {
    const { apiDefinitions, globals } = await runGenerate(FIXTURE)
    expect(apiDefinitions).toBeTruthy()
    expect(globals).toBeTruthy()
  })
})
