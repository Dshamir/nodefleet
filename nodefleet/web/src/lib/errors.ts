/**
 * Structured error codes for consistent API error responses.
 * Format: DOMAIN_ACTION_REASON
 */
export enum ErrorCode {
  // Auth errors
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',

  // Device errors
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  DEVICE_ALREADY_PAIRED = 'DEVICE_ALREADY_PAIRED',
  DEVICE_PAIRING_EXPIRED = 'DEVICE_PAIRING_EXPIRED',
  DEVICE_PAIRING_INVALID = 'DEVICE_PAIRING_INVALID',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
}

export interface ApiError {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}

/**
 * Create a structured JSON error response.
 */
export function createErrorResponse(code: ErrorCode, message: string, status: number, details?: Record<string, unknown>) {
  return Response.json(
    { error: { code, message, details } } satisfies { error: ApiError },
    { status }
  )
}
