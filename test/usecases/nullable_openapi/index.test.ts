import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('nullable_openapi', () => {
  it('handles nullable: true and 3.1 type array', async () => {
    const { globals } = await runGenerate(FIXTURE)
    expect(globals).toBeTruthy()
    // At least one occurrence of `| null`
    expect(globals).toContain('null')
  })
})
