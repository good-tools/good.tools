import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JsonEscape from './JsonEscape'
import { useJsonEscapeStore } from '@/stores'

// Reset store state before each test
beforeEach(() => {
  useJsonEscapeStore.getState().reset()
})

describe('JsonEscape', () => {
  it('renders with empty textarea and three buttons', () => {
    render(<JsonEscape />)
    expect(screen.getByPlaceholderText(/paste your text here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^escape$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unescape/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  describe('Escape functionality', () => {
    it('escapes double quotes', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        act(() => {
          useJsonEscapeStore.getState().setInput('Hello "World"')
        })
      })
      await user.click(screen.getByRole('button', { name: /^escape$/i }))

      expect(input).toHaveValue('Hello \\"World\\"')
    })

    it('escapes backslashes', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        act(() => {
          useJsonEscapeStore.getState().setInput('C:\\Users\\Test')
        })
      })
      await user.click(screen.getByRole('button', { name: /^escape$/i }))

      expect(input).toHaveValue('C:\\\\Users\\\\Test')
    })

    it('escapes newlines', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      // Directly set value with newline
      act(() => {
        useJsonEscapeStore.getState().setInput('Line1\nLine2')
      })
      await user.click(screen.getByRole('button', { name: /^escape$/i }))

      expect(input).toHaveValue('Line1\\nLine2')
    })

    it('escapes tabs', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        useJsonEscapeStore.getState().setInput('Column1\tColumn2')
      })
      await user.click(screen.getByRole('button', { name: /^escape$/i }))

      expect(input).toHaveValue('Column1\\tColumn2')
    })

    it('escapes carriage returns', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        useJsonEscapeStore.getState().setInput('Line1\rLine2')
      })
      await user.click(screen.getByRole('button', { name: /^escape$/i }))

      expect(input).toHaveValue('Line1\\rLine2')
    })

    it('escapes multiple special characters at once', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        useJsonEscapeStore.getState().setInput('Hello "World"\nNew line\tTab')
      })
      await user.click(screen.getByRole('button', { name: /^escape$/i }))

      expect(input).toHaveValue('Hello \\"World\\"\\nNew line\\tTab')
    })

    it('handles empty input when escaping', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      await user.click(screen.getByRole('button', { name: /^escape$/i }))

      expect(input).toHaveValue('')
    })
  })

  describe('Unescape functionality', () => {
    it('unescapes double quotes', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        useJsonEscapeStore.getState().setInput('Hello \\"World\\"')
      })
      await user.click(screen.getByRole('button', { name: /unescape/i }))

      expect(input).toHaveValue('Hello "World"')
    })

    it('unescapes newlines', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        useJsonEscapeStore.getState().setInput('Line1\\nLine2')
      })
      await user.click(screen.getByRole('button', { name: /unescape/i }))

      expect(input).toHaveValue('Line1\nLine2')
    })

    it('unescapes tabs', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        useJsonEscapeStore.getState().setInput('Column1\\tColumn2')
      })
      await user.click(screen.getByRole('button', { name: /unescape/i }))

      expect(input).toHaveValue('Column1\tColumn2')
    })

    it('unescapes backslashes', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        useJsonEscapeStore.getState().setInput('C:\\\\Users\\\\Test')
      })
      await user.click(screen.getByRole('button', { name: /unescape/i }))

      expect(input).toHaveValue('C:\\Users\\Test')
    })

    it('unescapes multiple special characters at once', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      act(() => {
        useJsonEscapeStore.getState().setInput('Hello \\"World\\"\\nNew line\\tTab')
      })
      await user.click(screen.getByRole('button', { name: /unescape/i }))

      expect(input).toHaveValue('Hello "World"\nNew line\tTab')
    })

    it('handles empty input when unescaping', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      await user.click(screen.getByRole('button', { name: /unescape/i }))

      expect(input).toHaveValue('')
    })
  })

  describe('Clear functionality', () => {
    it('clears the textarea when Clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      await user.type(input, 'Some text')
      expect(input).toHaveValue('Some text')

      await user.click(screen.getByRole('button', { name: /clear/i }))

      expect(input).toHaveValue('')
    })

    it('clears after escape operation', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      await user.type(input, 'Hello "World"')
      await user.click(screen.getByRole('button', { name: /^escape$/i }))
      expect(input).toHaveValue('Hello \\"World\\"')

      await user.click(screen.getByRole('button', { name: /clear/i }))

      expect(input).toHaveValue('')
    })
  })

  describe('Round-trip operations', () => {
    it('escape then unescape returns original text', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      const originalText = 'Hello "World"\nNew line\tTab'
      act(() => {
        useJsonEscapeStore.getState().setInput(originalText)
      })

      // Escape
      await user.click(screen.getByRole('button', { name: /^escape$/i }))
      const escapedValue = (input as HTMLTextAreaElement).value
      expect(escapedValue).toBe('Hello \\"World\\"\\nNew line\\tTab')

      // Unescape
      await user.click(screen.getByRole('button', { name: /unescape/i }))
      expect(input).toHaveValue(originalText)
    })
  })

  describe('Store integration', () => {
    it('updates store when typing in textarea', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      await user.type(input, 'test')

      expect(useJsonEscapeStore.getState().input).toBe('test')
    })

    it('resets store when Clear is clicked', async () => {
      const user = userEvent.setup()
      render(<JsonEscape />)

      const input = screen.getByPlaceholderText(/paste your text here/i)
      await user.type(input, 'test')
      expect(useJsonEscapeStore.getState().input).toBe('test')

      await user.click(screen.getByRole('button', { name: /clear/i }))

      expect(useJsonEscapeStore.getState().input).toBe('')
    })
  })
})
