import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/ui/toast'

function TestConsumer() {
  const { showToast } = useToast()
  return (
    <button onClick={() => showToast('Test message', 'success')}>
      Show Toast
    </button>
  )
}

describe('Toast system', () => {
  it('renders children without crashing', () => {
    render(
      <ToastProvider>
        <div data-testid="child">Hello</div>
      </ToastProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('shows toast when showToast is called', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      screen.getByText('Show Toast').click()
    })

    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('throws when useToast is used outside ToastProvider', () => {
    function BadConsumer() {
      useToast()
      return null
    }

    expect(() => render(<BadConsumer />)).toThrow(
      'useToast must be used within a ToastProvider'
    )
  })
})
