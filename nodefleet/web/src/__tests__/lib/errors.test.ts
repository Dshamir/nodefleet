import { describe, it, expect } from 'vitest'
import { ErrorCode, createErrorResponse } from '@/lib/errors'

describe('ErrorCode enum', () => {
  it('has all auth error codes', () => {
    expect(ErrorCode.AUTH_INVALID_CREDENTIALS).toBe('AUTH_INVALID_CREDENTIALS')
    expect(ErrorCode.AUTH_ACCOUNT_LOCKED).toBe('AUTH_ACCOUNT_LOCKED')
    expect(ErrorCode.AUTH_SESSION_EXPIRED).toBe('AUTH_SESSION_EXPIRED')
    expect(ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS).toBe('AUTH_INSUFFICIENT_PERMISSIONS')
  })

  it('has all device error codes', () => {
    expect(ErrorCode.DEVICE_NOT_FOUND).toBe('DEVICE_NOT_FOUND')
    expect(ErrorCode.DEVICE_ALREADY_PAIRED).toBe('DEVICE_ALREADY_PAIRED')
    expect(ErrorCode.DEVICE_PAIRING_EXPIRED).toBe('DEVICE_PAIRING_EXPIRED')
    expect(ErrorCode.DEVICE_PAIRING_INVALID).toBe('DEVICE_PAIRING_INVALID')
  })

  it('has rate limit and validation codes', () => {
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED')
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
  })

  it('has generic error codes', () => {
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND')
    expect(ErrorCode.CONFLICT).toBe('CONFLICT')
  })
})

describe('createErrorResponse', () => {
  it('returns a Response with the correct status', async () => {
    const response = createErrorResponse(ErrorCode.NOT_FOUND, 'Device not found', 404)
    expect(response.status).toBe(404)
  })

  it('returns a JSON body with the correct structure', async () => {
    const response = createErrorResponse(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Bad credentials', 401)
    const body = await response.json()
    expect(body).toEqual({
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Bad credentials',
      },
    })
  })

  it('includes details when provided', async () => {
    const details = { field: 'email', reason: 'invalid format' }
    const response = createErrorResponse(ErrorCode.VALIDATION_ERROR, 'Validation failed', 400, details)
    const body = await response.json()
    expect(body.error.details).toEqual(details)
  })

  it('omits details when not provided', async () => {
    const response = createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Something went wrong', 500)
    const body = await response.json()
    expect(body.error.details).toBeUndefined()
  })
})
