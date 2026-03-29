import { describe, it, expect } from 'vitest'
import {
  createDeviceSchema,
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from '@/lib/schemas'

describe('createDeviceSchema', () => {
  it('accepts valid input', () => {
    const result = createDeviceSchema.safeParse({
      name: 'Sensor-A1',
      hwModel: 'ESP32-S3',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with optional fields', () => {
    const result = createDeviceSchema.safeParse({
      name: 'Sensor-A1',
      hwModel: 'ESP32-S3',
      serialNumber: 'SN-001',
      fleetId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createDeviceSchema.safeParse({
      name: '',
      hwModel: 'ESP32-S3',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('name')
    }
  })

  it('rejects missing hwModel', () => {
    const result = createDeviceSchema.safeParse({
      name: 'Sensor-A1',
      hwModel: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const validData = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'SecurePass1',
    confirmPassword: 'SecurePass1',
  }

  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'Short1',
      confirmPassword: 'Short1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without uppercase letter', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'lowercase1',
      confirmPassword: 'lowercase1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without a number', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'NoNumberHere',
      confirmPassword: 'NoNumberHere',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched confirmPassword', () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: 'DifferentPass1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('confirmPassword')
    }
  })
})

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'anything',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'anything',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('email')
    }
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  const validData = {
    currentPassword: 'OldPassword1',
    newPassword: 'NewPassword1',
    confirmPassword: 'NewPassword1',
  }

  it('accepts valid change password data', () => {
    const result = changePasswordSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects weak new password', () => {
    const result = changePasswordSchema.safeParse({
      ...validData,
      newPassword: 'weak',
      confirmPassword: 'weak',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched confirm password', () => {
    const result = changePasswordSchema.safeParse({
      ...validData,
      confirmPassword: 'Mismatch1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('confirmPassword')
    }
  })

  it('rejects empty current password', () => {
    const result = changePasswordSchema.safeParse({
      ...validData,
      currentPassword: '',
    })
    expect(result.success).toBe(false)
  })
})
