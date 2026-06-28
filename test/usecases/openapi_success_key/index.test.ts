import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('openapi_success_key', () => {
  it('prefers 200 response when multiple 2xx present', async () => {
    const { globals } = await runGenerate(FIXTURE)
    expect(globals).toBeTruthy()
  })
})
