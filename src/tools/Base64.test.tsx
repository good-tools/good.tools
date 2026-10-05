import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Base64, { parseBase64 } from './Base64'
import { useBase64Store } from '@/stores/base64.store'

beforeEach(() => useBase64Store.getState().resetAll())

const result = () => screen.getByLabelText('Result')

describe('Base64', () => {
  it('encodes as you type, including unicode', async () => {
    render(<Base64 />)
    await userEvent.type(screen.getByLabelText('Text to encode'), 'héllo €')
    expect(result()).toHaveValue('aMOpbGxvIOKCrA==')
  })

  it('supports URL-safe output', async () => {
    useBase64Store.setState({ input: '??>>' })
    render(<Base64 />)
    expect(result()).toHaveValue('Pz8+Pg==')
    await userEvent.click(screen.getByLabelText('URL-safe'))
    expect(result()).toHaveValue('Pz8-Pg')
  })

  it('decodes and swaps back', async () => {
    useBase64Store.setState({ mode: 'decode', input: 'SGVsbG8sIFdvcmxkIQ==' })
    render(<Base64 />)
    expect(result()).toHaveValue('Hello, World!')
    await userEvent.click(screen.getByRole('button', { name: /swap/i }))
    expect(useBase64Store.getState()).toMatchObject({ mode: 'encode', input: 'Hello, World!' })
  })

  it('shows an error for invalid input instead of garbage', () => {
    useBase64Store.setState({ mode: 'decode', input: 'abc$' })
    render(<Base64 />)
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid base64 character "$"')
    expect(result()).toHaveValue('')
  })

  it('falls back to hex for binary data', () => {
    useBase64Store.setState({ mode: 'decode', input: '/w==' })
    render(<Base64 />)
    expect(result()).toHaveValue('ff')
    expect(screen.getByRole('status')).toHaveTextContent(/not valid UTF-8/)
  })
})

describe('parseBase64', () => {
  it('accepts whitespace and URL-safe alphabet', () => {
    expect(parseBase64('SGVs\nbG8=').toString()).toBe('Hello')
    expect(parseBase64('Pz8-Pg').toString()).toBe('??>>')
  })
  it('rejects bad padding', () => {
    expect(() => parseBase64('a===')).toThrow()
  })
})
