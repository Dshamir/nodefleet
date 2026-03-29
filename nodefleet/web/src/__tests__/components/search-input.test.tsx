import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchInput } from '@/components/ui/search-input'

describe('SearchInput', () => {
  it('renders with the given placeholder', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Find devices..." />)
    expect(screen.getByPlaceholderText('Find devices...')).toBeInTheDocument()
  })

  it('renders a search icon', () => {
    const { container } = render(<SearchInput value="" onChange={() => {}} />)
    // The lucide Search icon renders as an SVG
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('updates local value on type', () => {
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} placeholder="Search..." />)
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.change(input, { target: { value: 'hello' } })
    // The local value should update immediately (displayed in the input)
    expect(input).toHaveValue('hello')
  })

  it('renders with default placeholder when none provided', () => {
    render(<SearchInput value="" onChange={() => {}} />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })
})
