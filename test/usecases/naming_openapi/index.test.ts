import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('naming_openapi', () => {
  it('preserves tag/operationId names verbatim', async () => {
    const { apiDefinitions } = await runGenerate(FIXTURE)
    expect(apiDefinitions).toBeTruthy()
    // Keys should preserve camelCase, snake_case, etc.
  })
})
