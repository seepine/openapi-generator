import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('swagger_2', () => {
  it('parses Swagger 2.0 spec', async () => {
    const { apiDefinitions, globals } = await runGenerate(FIXTURE)
    expect(apiDefinitions).toBeTruthy()
    expect(globals).toBeTruthy()
  })
})
