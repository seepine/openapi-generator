import { describe, it, expect } from 'vitest'
import { runGenerate, createStrReg } from '../../_helper'

const FIXTURE = `${__dirname}`

describe('oauth_send_code', () => {
  it('apiDefinitions contains the sendCode entry under auth tag', async () => {
    const { apiDefinitions } = await runGenerate(FIXTURE)
    expect(apiDefinitions).toContain(
      "'auth.sendCode': ['POST', '/oauth/send/code']",
    )
  })

  it('globals.d.ts uses the oneOf const discriminator with two branches', async () => {
    const { globals } = await runGenerate(FIXTURE)
    // const discriminator produces literal types (spec §3.3.5)
    expect(globals).toContain("channel: 'email';")
    expect(globals).toContain("channel: 'phone';")

    // format / pattern are validation hints, NOT type narrowing
    // → email / phone / uniqueId all stay as `string`
    expect(globals).toContain('email: string;')
    expect(globals).toContain('phone: string;')

    // uniqueId is not in `required`, so it must be optional
    expect(globals).toContain('uniqueId?: string;')

    // The two branches are joined with `|` (no merge)
    expect(globals).toMatch(
      createStrReg(
        "data: { channel: 'email'; email: string; uniqueId?: string; } | { channel: 'phone'; phone: string; uniqueId?: string; };",
      ),
    )
  })

  it('sendCode method is wrapped under the auth namespace', async () => {
    const { globals } = await runGenerate(FIXTURE)
    expect(globals).toContain('auth: {')
    expect(globals).toContain(
      'sendCode<Config extends Alova2MethodConfig<unknown> & { data:',
    )
    expect(globals).toMatch(/Alova2Method<unknown, 'auth\.sendCode', Config>/)
  })

  it('security scheme is not surfaced in the generated types', async () => {
    const { apiDefinitions, globals } = await runGenerate(FIXTURE)
    // security is metadata only — it must not leak into request / response types
    expect(apiDefinitions).not.toMatch(/security/i)
    expect(globals).not.toMatch(/security/i)
    expect(globals).not.toMatch(/HTTP Bearer/i)
  })

  it('createApis and index.ts are produced', async () => {
    const { createApis, index } = await runGenerate(FIXTURE)
    expect(createApis).toContain('(globalThis as any).Apis = Apis')
    expect(index).toContain('alovaInstance')
    expect(index).toContain('baseURL')
  })
})
