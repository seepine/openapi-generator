import { describe, it, expect } from 'vitest'
import { tagKey, toIdentifier } from '../../src/utils/strings'

describe('toIdentifier', () => {
  it('converts kebab-case to camelCase', () => {
    expect(toIdentifier('admin-config')).toBe('adminConfig')
    expect(toIdentifier('users-v2')).toBe('usersV2')
    expect(toIdentifier('admin-config-api')).toBe('adminConfigApi')
  })

  it('leaves single-word identifiers alone', () => {
    expect(toIdentifier('users')).toBe('users')
    expect(toIdentifier('auth')).toBe('auth')
  })

  it('is idempotent on camelCase input', () => {
    expect(toIdentifier('adminConfig')).toBe('adminConfig')
    expect(toIdentifier('usersV2')).toBe('usersV2')
  })

  it('lowercases PascalCase', () => {
    expect(toIdentifier('AdminConfig')).toBe('adminConfig')
  })

  it('handles snake_case', () => {
    expect(toIdentifier('admin_config')).toBe('adminConfig')
  })

  it('drops empty segments from mixed separators', () => {
    expect(toIdentifier('admin--config')).toBe('adminConfig')
    expect(toIdentifier('admin-_config')).toBe('adminConfig')
  })

  it('falls back to "_" for empty / whitespace input', () => {
    expect(toIdentifier('')).toBe('_')
    expect(toIdentifier('   ')).toBe('_')
    expect(toIdentifier('---')).toBe('_')
  })

  it('prefixes "_" when the result would start with a digit', () => {
    expect(toIdentifier('123-users')).toBe('_123Users')
  })
})

describe('tagKey', () => {
  it('returns "default" for empty input', () => {
    expect(tagKey('')).toBe('default')
  })

  it('normalizes a real tag via toIdentifier', () => {
    expect(tagKey('admin-config')).toBe('adminConfig')
    expect(tagKey('auth')).toBe('auth')
  })

  // Whitespace-only input is the loader's responsibility — it trims before
  // calling `tagKey`. Documenting the current behavior here so the
  // contract isn't silently changed.
  it('passes whitespace-only input through to toIdentifier', () => {
    expect(tagKey('   ')).toBe('_')
  })
})
