import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SignPdf from './SignPdf'

describe('SignPdf', () => {
  it('asks for a PDF first', () => {
    render(<SignPdf />)
    expect(screen.getByText('Drop a PDF here or click to browse')).toBeInTheDocument()
    expect(screen.getByText(/Nothing is uploaded/)).toBeInTheDocument()
  })
})
