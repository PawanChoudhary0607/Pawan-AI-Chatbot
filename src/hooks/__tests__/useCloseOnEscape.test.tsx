import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape'

function TestComponent({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  useCloseOnEscape(enabled, onClose)
  return null
}

describe('useCloseOnEscape', () => {
  it('calls onClose on Escape when enabled', async () => {
    const onClose = vi.fn()
    render(<TestComponent enabled={true} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled', async () => {
    const onClose = vi.fn()
    render(<TestComponent enabled={false} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
  })

  it('removes its listener on unmount', async () => {
    const onClose = vi.fn()
    const { unmount } = render(<TestComponent enabled={true} onClose={onClose} />)
    unmount()

    await userEvent.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
  })
})
