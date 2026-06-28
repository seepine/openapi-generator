import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('openapi_300', () => {
  it('parses OpenAPI 3.0 spec', async () => {
    const { apiDefinitions, globals } = await runGenerate(FIXTURE)
    expect(apiDefinitions).toBeTruthy()
    expect(globals).toBeTruthy()
  })
})
