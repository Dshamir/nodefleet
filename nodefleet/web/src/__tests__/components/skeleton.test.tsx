import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from '@/components/ui/skeleton'

describe('Skeleton component', () => {
  it('renders with default classes', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveClass('animate-pulse')
    expect(el).toHaveClass('rounded')
    expect(el).toHaveClass('bg-slate-700')
  })

  it('accepts custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveClass('h-4')
    expect(el).toHaveClass('w-32')
  })

  it('passes through additional props', () => {
    const { container } = render(<Skeleton data-testid="skel" />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('data-testid')).toBe('skel')
  })
})
