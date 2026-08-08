import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StartupLoadingScreen } from '@/components/layout/StartupLoadingScreen'

describe('StartupLoadingScreen', () => {
  it('renders an accessible loading status', () => {
    render(<StartupLoadingScreen />)
    expect(screen.getByRole('status', { name: /loading pawan ai chatbot/i })).toBeInTheDocument()
  })
})
