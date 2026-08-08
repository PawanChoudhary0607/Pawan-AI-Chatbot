import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

function TestComponent() {
  const isOnline = useOnlineStatus()
  return <span>{isOnline ? 'online' : 'offline'}</span>
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('reflects navigator.onLine initially', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    render(<TestComponent />)
    expect(screen.getByText('online')).toBeInTheDocument()
  })

  it('updates to offline when the offline event fires', () => {
    render(<TestComponent />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText('offline')).toBeInTheDocument()
  })

  it('updates back to online when the online event fires', () => {
    render(<TestComponent />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText('offline')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByText('online')).toBeInTheDocument()
  })
})
