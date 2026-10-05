import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useURLStore } from '@/stores'
import URL from './URL'

beforeEach(() => {
  useURLStore.getState().resetAll()
})

const result = () => screen.getByLabelText('Result')

async function decode(value: string) {
  const user = userEvent.setup()
  render(<URL />)
  await user.click(screen.getByRole('radio', { name: 'Decode' }))
  fireEvent.change(screen.getByLabelText(/url-encoded text to decode/i), { target: { value } })
  return user
}

describe('URL', () => {
  it('encodes text live', () => {
    render(<URL />)
    fireEvent.change(screen.getByLabelText('Text to encode'), { target: { value: 'a b&c' } })
    expect(result()).toHaveValue('a%20b%26c')
  })

  it('shows an error for malformed percent sequences', async () => {
    await decode('100%')
    expect(screen.getByRole('alert')).toHaveTextContent(/malformed/i)
    expect(result()).toHaveValue('')
  })

  it('keeps + literal by default and decodes it as space when enabled', async () => {
    const user = await decode('a+b%20c')
    expect(result()).toHaveValue('a+b c')
    await user.click(screen.getByLabelText(/treat \+ as space/i))
    expect(result()).toHaveValue('a b c')
  })

  it('swaps output into input and flips mode', async () => {
    const user = userEvent.setup()
    render(<URL />)
    fireEvent.change(screen.getByLabelText('Text to encode'), { target: { value: 'a b' } })
    await user.click(screen.getByRole('button', { name: /swap/i }))
    expect(screen.getByLabelText(/to decode/i)).toHaveValue('a%20b')
    expect(result()).toHaveValue('a b')
  })
})
