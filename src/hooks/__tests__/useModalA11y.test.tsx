import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { useModalA11y } from '@/hooks/useModalA11y'

function TestModal({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y(containerRef, onClose)
  return (
    <div ref={containerRef} role="dialog">
      <button>First</button>
      <button>Second</button>
      <button>Last</button>
    </div>
  )
}

describe('useModalA11y', () => {
  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    render(<TestModal onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('wraps Tab from the last focusable element back to the first', async () => {
    const onClose = vi.fn()
    render(<TestModal onClose={onClose} />)

    screen.getByText('Last').focus()
    await userEvent.tab()

    expect(document.activeElement).toBe(screen.getByText('First'))
  })

  it('wraps Shift+Tab from the first focusable element back to the last', async () => {
    const onClose = vi.fn()
    render(<TestModal onClose={onClose} />)

    screen.getByText('First').focus()
    await userEvent.tab({ shift: true })

    expect(document.activeElement).toBe(screen.getByText('Last'))
  })

  it('restores focus to the previously-focused element when the modal unmounts', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Open modal'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const onClose = vi.fn()
    const { unmount } = render(<TestModal onClose={onClose} />)
    unmount()

    expect(document.activeElement).toBe(trigger)
    document.body.removeChild(trigger)
  })
})
