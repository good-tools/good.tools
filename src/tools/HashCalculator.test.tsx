import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HashCalculator from './HashCalculator'

describe('HashCalculator', () => {
  it('hashes non-ASCII input as UTF-8', async () => {
    render(<HashCalculator />)
    fireEvent.change(screen.getByLabelText('Input'), { target: { value: 'héllo wörld ✓' } })

    expect(await screen.findByText('aa0c8a307a4488bfe0cb56530da19bc3')).toHaveAttribute('id', 'hash-MD5')
    expect(await screen.findByText('a5e7f35caea50aa6f3bc37d2f24a540fc0b3cb32')).toHaveAttribute('id', 'hash-SHA-1')
    expect(await screen.findByText('c2a59c71097b678dc5af2eb1f98ddc575b63948b0fa6740071a945673aaada4d')).toHaveAttribute(
      'id',
      'hash-SHA-256',
    )
  })

  it('uppercases digests on demand', async () => {
    render(<HashCalculator />)
    fireEvent.change(screen.getByLabelText('Input'), { target: { value: 'héllo wörld ✓' } })
    await screen.findByText('aa0c8a307a4488bfe0cb56530da19bc3')
    fireEvent.click(screen.getByLabelText('Uppercase'))
    expect(screen.getByText('AA0C8A307A4488BFE0CB56530DA19BC3')).toBeInTheDocument()
  })
})
