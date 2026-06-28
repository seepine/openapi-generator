import { describe, it, expect } from 'vitest'
import { runGenerate } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('const_discriminator_openapi', () => {
  it('generates 5 files successfully', async () => {
    const { apiDefinitions, globals } = await runGenerate(FIXTURE)
    expect(apiDefinitions).toContain(
      "  'auth.forgetPassword': ['POST', '/forget/password']",
    )
    expect(apiDefinitions).toContain(
      "  'auth.oauthToken': ['POST', '/oauth/token']",
    )
    expect(apiDefinitions).toContain(
      "  'auth.toggleIntegration': ['POST', '/integrations/toggle']",
    )

    // forgetPassword: const discriminator on channel='email' | 'phone'.
    // Verify the structure of both branches exists.
    expect(globals).toContain("channel: 'email';")
    expect(globals).toContain("channel: 'phone';")
    expect(globals).toContain('email: string;')
    expect(globals).toContain('phone: string;')
    expect(globals).toContain('password: string;')
    expect(globals).toContain('code: string;')

    // toggleIntegration: boolean const discriminator (enabled: false | true)
    expect(globals).toContain('enabled: false;')
    expect(globals).toContain('enabled: true;')

    // oauthToken: 4 grant_type const discriminator branches
    expect(globals).toContain("grant_type: 'password';")
    expect(globals).toContain("grant_type: 'authorization_code';")
    expect(globals).toContain("grant_type: 'refresh_token';")
    expect(globals).toContain(
      "grant_type: 'client_credentials' | 'device_code';",
    )

    // Operations are wrapped under auth. namespace
    expect(globals).toContain('auth: {')
  })

  it('createApis contains globalThis assignment', async () => {
    const { createApis } = await runGenerate(FIXTURE)
    expect(createApis).toContain('(globalThis as any).Apis = Apis')
  })

  it('index.ts contains alovaInstance config', async () => {
    const { index } = await runGenerate(FIXTURE)
    expect(index).toContain('alovaInstance')
    expect(index).toContain('baseURL')
  })
})
