import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLogger } from '@/lib/logger'

describe('createLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a logger with the given module name', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createLogger('test-module')
    logger.info('hello')
    expect(spy).toHaveBeenCalled()
    const output = spy.mock.calls[0][0] as string
    expect(output).toContain('test-module')
    expect(output).toContain('hello')
  })

  it('supports context objects', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createLogger('ctx-test')
    logger.info('user action', { userId: '123', action: 'login' })
    const output = spy.mock.calls[0][0] as string
    expect(output).toContain('user action')
    expect(output).toContain('123')
  })

  it('supports all log levels', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const logger = createLogger('levels')
    logger.debug('debug msg')
    logger.info('info msg')
    logger.warn('warn msg')
    logger.error('error msg')

    expect(debugSpy).toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('withCorrelationId returns a new logger', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createLogger('cid-test')
    const child = logger.withCorrelationId('custom-cid-123')
    child.info('with custom cid')
    const output = spy.mock.calls[0][0] as string
    expect(output).toContain('custom-c')
  })
})
