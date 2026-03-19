import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/api/client'

const AUTO_RELOCK_MS = 5 * 60 * 1000 // 5 minutes

type FieldType = 'name' | 'email' | 'phone' | 'dob'

export function maskValue(value: string | null | undefined, fieldType: FieldType): string {
  if (!value) return '\u2014'

  switch (fieldType) {
    case 'name':
      return value
        .split(' ')
        .map(word => (word.length > 0 ? word[0] + '*'.repeat(Math.max(word.length - 1, 2)) : ''))
        .join(' ')

    case 'email': {
      const atIdx = value.indexOf('@')
      if (atIdx <= 0) return '****@****'
      return value[0] + '****' + value.slice(atIdx)
    }

    case 'phone': {
      const digits = value.replace(/\D/g, '')
      if (digits.length < 4) return '***-***-****'
      return '***-***-' + digits.slice(-4)
    }

    case 'dob': {
      // Show only year: **/**/1990
      const match = value.match(/(\d{4})/)
      if (match) return '**/**/' + match[1]
      return '**/**/****'
    }

    default:
      return value
  }
}

export function useHipaaMask() {
  const [unmasked, setUnmasked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const toggle = useCallback(() => {
    setUnmasked(prev => {
      const next = !prev
      if (next) {
        // Unmasking — fire audit + start auto-relock
        api.post('/admin/vitals/unmask-audit').catch(() => {})
        clearTimer()
        timerRef.current = setTimeout(() => setUnmasked(false), AUTO_RELOCK_MS)
      } else {
        clearTimer()
      }
      return next
    })
  }, [clearTimer])

  const mask = useCallback(
    (value: string | null | undefined, fieldType: FieldType): string => {
      if (unmasked) return value || '\u2014'
      return maskValue(value, fieldType)
    },
    [unmasked],
  )

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  return { unmasked, toggle, mask }
}
