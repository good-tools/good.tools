import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JwtDecoder from './JwtDecoder'

describe('JwtDecoder', () => {
  it('decodes and verifies the example token', async () => {
    render(<JwtDecoder />)
    await userEvent.click(screen.getByRole('button', { name: /load example/i }))
    expect(screen.getAllByText(/Valid JWT/)[0]).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(await screen.findAllByText(/Signature verified/)).not.toHaveLength(0)
  })

  it('flags a wrong secret and malformed tokens', async () => {
    render(<JwtDecoder />)
    await userEvent.click(screen.getByRole('button', { name: /load example/i }))
    const secret = screen.getByLabelText('Secret')
    await userEvent.type(secret, 'x')
    expect(await screen.findByText(/does not match/)).toBeInTheDocument()

    const token = screen.getByLabelText('Encoded JWT')
    await userEvent.clear(token)
    await userEvent.type(token, 'not-a-jwt')
    expect(screen.getByRole('alert')).toHaveTextContent('3 dot-separated parts')
  })
})
