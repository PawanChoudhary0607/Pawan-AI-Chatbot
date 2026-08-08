import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModalSkeleton } from '@/components/layout/ModalSkeleton'

describe('ModalSkeleton', () => {
  it('renders an accessible loading status', () => {
    render(<ModalSkeleton />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})
