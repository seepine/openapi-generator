import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('non_variable_specification_openapi', () => {
  it('handles various spec shapes', async () => {
    const { globals } = await runGenerate(FIXTURE)
    expect(globals).toBeTruthy()
  })
})
