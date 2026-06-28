import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('hyphenated_tag_openapi', () => {
  it('globals.d.ts interface uses camelCase identifiers for tags', async () => {
    const { globals } = await runGenerate(FIXTURE)
    // Each hyphenated / snake_case tag should be normalized to camelCase.
    expect(globals).toContain('adminConfig: {')
    expect(globals).toContain('billingV2: {')
    expect(globals).toContain('snakeCaseTag: {')
    // The raw tag strings must not appear as interface keys.
    expect(globals).not.toMatch(/^\s+admin-config:/m)
    expect(globals).not.toMatch(/^\s+billing-v2:/m)
    expect(globals).not.toMatch(/^\s+snake_case_tag:/m)
  })

  it('apiDefinitions key is normalized to camelCase (matches interface)', async () => {
    const { apiDefinitions } = await runGenerate(FIXTURE)
    // Wormhole normalizes tags via standardLoader.transformTags, so the
    // apiDefinitions key must match the interface property in globals.d.ts.
    expect(apiDefinitions).toContain("'adminConfig.getConfig'")
    expect(apiDefinitions).toContain("'billingV2.report'")
    expect(apiDefinitions).toContain("'snakeCaseTag.ping'")
  })
})
