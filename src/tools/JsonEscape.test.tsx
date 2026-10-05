import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JsonEscape from './JsonEscape'
import { useJsonEscapeStore } from '@/stores'

beforeEach(() => {
  useJsonEscapeStore.getState().reset()
})

const output = () => screen.getByLabelText('Output')
const input = () => screen.getByLabelText('Input')

function run(mode: 'escape' | 'unescape', value: string) {
  render(<JsonEscape />)
  act(() => {
    useJsonEscapeStore.getState().setMode(mode)
    useJsonEscapeStore.getState().setInput(value)
  })
}

describe('JsonEscape', () => {
  it.each([
    ['Hello "World"', 'Hello \\"World\\"'],
    ['C:\\Users\\Test', 'C:\\\\Users\\\\Test'],
    ['Line1\nLine2', 'Line1\\nLine2'],
    ['Column1\tColumn2', 'Column1\\tColumn2'],
    ['Line1\rLine2', 'Line1\\rLine2'],
    ['a\u0001b \u00e9', 'a\\u0001b \u00e9'],
    ['', ''],
  ])('escapes %j live', (raw, escaped) => {
    run('escape', raw)
    expect(output()).toHaveValue(escaped)
  })

  it.each([
    ['Hello \\"World\\"', 'Hello "World"'],
    ['Line1\\nLine2', 'Line1\nLine2'],
    ['Column1\\tColumn2', 'Column1\tColumn2'],
    ['C:\\\\Users\\\\Test', 'C:\\Users\\Test'],
    ['', ''],
  ])('unescapes %j live', (escaped, raw) => {
    run('unescape', escaped)
    expect(output()).toHaveValue(raw)
  })

  it('shows an alert for invalid escapes instead of guessing', () => {
    run('unescape', 'bad \\x escape')
    expect(screen.getByRole('alert')).toHaveTextContent(/not a valid json string/i)
    expect(output()).toHaveValue('')
  })

  it('updates the store as you type and clears', async () => {
    const user = userEvent.setup()
    render(<JsonEscape />)
    await user.type(input(), 'a"b')
    expect(useJsonEscapeStore.getState().input).toBe('a"b')
    expect(output()).toHaveValue('a\\"b')
    await user.click(screen.getByRole('button', { name: /clear/i }))
    expect(input()).toHaveValue('')
    expect(output()).toHaveValue('')
  })

  it('swap round-trips', async () => {
    const user = userEvent.setup()
    run('escape', 'Hello "World"\nNew line\tTab')
    await user.click(screen.getByRole('button', { name: /swap/i }))
    expect(screen.getByRole('radio', { name: 'Unescape' })).toHaveAttribute('aria-checked', 'true')
    expect(input()).toHaveValue('Hello \\"World\\"\\nNew line\\tTab')
    expect(output()).toHaveValue('Hello "World"\nNew line\tTab')
  })
})
