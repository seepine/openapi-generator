import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('no_tags_openapi', () => {
  it('groups untagged operations under the "default" namespace', async () => {
    const { apiDefinitions, globals } = await runGenerate(FIXTURE)
    // Both ops land in the apiDefinitions map; untagged ops share the
    // `default` namespace.
    expect(apiDefinitions).toMatch(/'default\.getA'/)
    expect(apiDefinitions).toMatch(/'default\.createB'/)
    // The interface groups them under a `default` property.
    expect(globals).toMatch(/default: \{/)
  })
})
