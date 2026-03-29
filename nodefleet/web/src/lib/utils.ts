import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistance } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'

/**
 * Merges Tailwind CSS class names with conflict resolution.
 * Combines `clsx` for conditional classes with `tailwind-merge` to
 * intelligently resolve conflicting Tailwind utility classes.
 * @param inputs - Class values (strings, arrays, objects, conditionals)
 * @returns Merged class string with conflicts resolved
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date using the specified format string.
 * Accepts both `Date` objects and ISO date strings.
 * @param date - Date object or ISO date string to format
 * @param formatStr - date-fns format pattern (default: `'MMM d, yyyy'`)
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  formatStr: string = 'MMM d, yyyy'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, formatStr)
}

/**
 * Returns a human-readable relative time string (e.g. "3 hours ago").
 * @param date - Date object or ISO date string
 * @returns Relative time string with suffix
 */
export function formatDateRelative(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatDistance(dateObj, new Date(), { addSuffix: true })
}

/**
 * Converts a byte count into a human-readable size string.
 * @param bytes - Number of bytes
 * @param decimals - Decimal places to display (default: 2)
 * @returns Formatted string (e.g. "1.5 MB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Generates a random alphanumeric pairing code for device provisioning.
 * Uses uppercase letters and digits (A-Z, 0-9).
 * @param length - Length of the code (default: 6)
 * @returns Random pairing code string
 */
export function generatePairingCode(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return code
}

/**
 * Generates a new UUID v4 identifier.
 * @returns UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateId(): string {
  return uuidv4()
}

/**
 * Converts a string into a URL-safe slug.
 * Lowercases, removes special characters, and replaces spaces with hyphens.
 * @param text - Input string to slugify
 * @returns URL-safe slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Validates an email address against a basic regex pattern.
 * @param email - Email string to validate
 * @returns `true` if the email matches the pattern
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Truncates a string to the specified length, appending "..." if truncated.
 * @param text - Input string
 * @param length - Maximum length before truncation (default: 50)
 * @returns Truncated string with ellipsis, or original if within limit
 */
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text
  return `${text.substring(0, length)}...`
}

/**
 * Safely parses a JSON string, returning `null` on failure instead of throwing.
 * @typeParam T - Expected parsed type
 * @param json - JSON string to parse, or `null`
 * @returns Parsed object of type `T`, or `null` if parsing fails
 */
export function parseJSON<T>(json: string | null): T | null {
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

/**
 * Returns a promise that resolves after the specified delay.
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retries an async function with exponential backoff on failure.
 * Each retry doubles the delay between attempts.
 * @typeParam T - Return type of the function
 * @param fn - Async function to retry
 * @param retries - Maximum number of retries (default: 3)
 * @param delayMs - Initial delay between retries in ms (default: 1000)
 * @returns Promise resolving to the function's return value
 * @throws The last error if all retries are exhausted
 */
export function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  return fn().catch((error) => {
    if (retries <= 0) throw error
    return delay(delayMs).then(() => retry(fn, retries - 1, delayMs * 2))
  })
}

/**
 * Creates a debounced version of a function that delays invocation
 * until after the specified wait time has elapsed since the last call.
 * @typeParam T - Function type
 * @param fn - Function to debounce
 * @param delayMs - Debounce delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      fn(...args)
      timeout = null
    }, delayMs)
  }
}

/**
 * Creates a throttled version of a function that executes at most once
 * per the specified time window.
 * @typeParam T - Function type
 * @param fn - Function to throttle
 * @param delayMs - Minimum interval between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delayMs) {
      lastCall = now
      fn(...args)
    }
  }
}

/**
 * Capitalizes the first letter of a string.
 * @param text - Input string
 * @returns String with first character uppercased
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Returns the singular or plural form of a word based on count.
 * Appends "s" for plural (English simple pluralization).
 * @param word - Singular form of the word
 * @param count - Quantity to check
 * @returns Singular word if count is 1, otherwise plural
 */
export function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`
}

/**
 * Generates an array of numbers from `start` (inclusive) to `end` (exclusive).
 * @param start - Starting value (inclusive)
 * @param end - Ending value (exclusive)
 * @param step - Increment between values (default: 1)
 * @returns Array of numbers in the specified range
 */
export function range(start: number, end: number, step: number = 1): number[] {
  const result: number[] = []
  for (let i = start; i < end; i += step) {
    result.push(i)
  }
  return result
}

/**
 * Returns a random integer between `min` and `max` (inclusive).
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Random integer in the range [min, max]
 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Detects whether the user's system prefers dark mode.
 * Returns `false` during server-side rendering.
 * @returns `true` if the OS/browser prefers dark color scheme
 */
export function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Extracts up to two initials from a full name.
 * @param name - Full name string (e.g. "John Doe")
 * @returns Uppercase initials (e.g. "JD")
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

/**
 * Returns Tailwind CSS classes for a status badge based on the status string.
 * Supported statuses: active, inactive, pending, error, warning.
 * @param status - Status identifier
 * @returns Tailwind class string for background and text color
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-orange-100 text-orange-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

/**
 * Safely serializes a value to a JSON string, returning `'{}'` on error
 * instead of throwing.
 * @param obj - Value to serialize
 * @param indent - Number of spaces for indentation (default: 2)
 * @returns JSON string, or `'{}'` if serialization fails
 */
export function safeJsonStringify(obj: unknown, indent: number = 2): string {
  try {
    return JSON.stringify(obj, null, indent)
  } catch (error) {
    console.error('JSON stringify error:', error)
    return '{}'
  }
}
