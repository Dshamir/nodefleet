import { describe, it, expect } from 'vitest'
import {
  cn,
  formatBytes,
  generatePairingCode,
  slugify,
  validateEmail,
  truncate,
  parseJSON,
  capitalize,
  pluralize,
  range,
  getInitials,
  getStatusColor,
  safeJsonStringify,
} from '@/lib/utils'

describe('cn (class name merger)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })
  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })
  it('deduplicates Tailwind classes', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6')
  })
})

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
  })
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 Bytes')
  })
  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
  })
  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB')
  })
  it('formats gigabytes with decimals', () => {
    expect(formatBytes(1073741824, 1)).toBe('1 GB')
  })
  it('respects decimal precision', () => {
    expect(formatBytes(1500, 0)).toBe('1 KB')
    expect(formatBytes(1500, 2)).toBe('1.46 KB')
  })
})

describe('generatePairingCode', () => {
  it('generates code of default length 6', () => {
    const code = generatePairingCode()
    expect(code).toHaveLength(6)
  })
  it('generates code of custom length', () => {
    expect(generatePairingCode(8)).toHaveLength(8)
  })
  it('contains only uppercase alphanumeric chars', () => {
    const code = generatePairingCode(100)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })
  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generatePairingCode()))
    expect(codes.size).toBeGreaterThan(90)
  })
})

describe('slugify', () => {
  it('converts to lowercase kebab-case', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })
  it('removes special characters', () => {
    expect(slugify('Hello! @World#')).toBe('hello-world')
  })
  it('collapses multiple dashes', () => {
    expect(slugify('a  --  b')).toBe('a-b')
  })
})

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('a.b@c.co')).toBe(true)
  })
  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('not-an-email')).toBe(false)
    expect(validateEmail('@no-user.com')).toBe(false)
    expect(validateEmail('user@')).toBe(false)
  })
})

describe('truncate', () => {
  it('leaves short text unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })
  it('truncates long text with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...')
  })
  it('uses default length of 50', () => {
    const text = 'a'.repeat(60)
    expect(truncate(text)).toBe('a'.repeat(50) + '...')
  })
})

describe('parseJSON', () => {
  it('parses valid JSON', () => {
    expect(parseJSON('{"a":1}')).toEqual({ a: 1 })
  })
  it('returns null for invalid JSON', () => {
    expect(parseJSON('not json')).toBeNull()
  })
  it('returns null for null input', () => {
    expect(parseJSON(null)).toBeNull()
  })
})

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })
  it('handles single char', () => {
    expect(capitalize('a')).toBe('A')
  })
  it('handles empty string', () => {
    expect(capitalize('')).toBe('')
  })
})

describe('pluralize', () => {
  it('returns singular for count 1', () => {
    expect(pluralize('device', 1)).toBe('device')
  })
  it('returns plural for other counts', () => {
    expect(pluralize('device', 0)).toBe('devices')
    expect(pluralize('device', 5)).toBe('devices')
  })
})

describe('range', () => {
  it('generates a range', () => {
    expect(range(0, 5)).toEqual([0, 1, 2, 3, 4])
  })
  it('supports custom step', () => {
    expect(range(0, 10, 3)).toEqual([0, 3, 6, 9])
  })
  it('returns empty for invalid range', () => {
    expect(range(5, 0)).toEqual([])
  })
})

describe('getInitials', () => {
  it('extracts initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })
  it('handles single name', () => {
    expect(getInitials('John')).toBe('J')
  })
  it('limits to 2 initials', () => {
    expect(getInitials('John Michael Doe')).toBe('JM')
  })
})

describe('getStatusColor', () => {
  it('returns color for known statuses', () => {
    expect(getStatusColor('active')).toContain('green')
    expect(getStatusColor('error')).toContain('red')
    expect(getStatusColor('pending')).toContain('yellow')
  })
  it('returns default for unknown status', () => {
    expect(getStatusColor('unknown')).toContain('gray')
  })
})

describe('safeJsonStringify', () => {
  it('stringifies valid objects', () => {
    expect(safeJsonStringify({ a: 1 })).toBe('{\n  "a": 1\n}')
  })
  it('handles circular references gracefully', () => {
    const obj: Record<string, unknown> = {}
    obj.self = obj
    expect(safeJsonStringify(obj)).toBe('{}')
  })
})
