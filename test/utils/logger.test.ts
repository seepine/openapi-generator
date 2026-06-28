import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setLogger, warn, error } from '../../src/utils/logger'

// Default console-backed implementations
const defaultWarn = (msg: string): void => {
  console.warn(`[openapi-generator] ${msg}`)
}
const defaultError = (msg: string): void => {
  console.error(`[openapi-generator] ${msg}`)
}

describe('logger', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Always reset to default before each test
    setLogger({ warn: defaultWarn, error: defaultError })
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    setLogger({})
  })

  it('warn prefixes with [openapi-generator]', () => {
    warn('something')
    expect(warnSpy).toHaveBeenCalledWith('[openapi-generator] something')
  })

  it('error prefixes with [openapi-generator]', () => {
    error('bad thing')
    expect(errorSpy).toHaveBeenCalledWith('[openapi-generator] bad thing')
  })

  it('setLogger overrides warn and error', () => {
    const customWarn = vi.fn()
    const customError = vi.fn()
    setLogger({ warn: customWarn, error: customError })
    warn('test1')
    error('test2')
    expect(customWarn).toHaveBeenCalledWith('test1')
    expect(customError).toHaveBeenCalledWith('test2')
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('setLogger with only warn overrides warn only', () => {
    const customWarn = vi.fn()
    setLogger({ warn: customWarn })
    warn('partial')
    error('still-default')
    expect(customWarn).toHaveBeenCalledWith('partial')
    expect(errorSpy).toHaveBeenCalledWith('[openapi-generator] still-default')
  })
})
