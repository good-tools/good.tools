import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Base64 from './Base64'
import { useBase64Store } from '@/stores'

// Reset store state before each test
beforeEach(() => {
  useBase64Store.getState().resetAll()
})

describe('Base64', () => {
  describe('Encoder', () => {
    it('renders encoder tab by default', () => {
      render(<Base64 />)
      expect(screen.getByRole('button', { name: /encode$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /encode inline/i })).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/paste your data/i)).toBeInTheDocument()
    })

    it('encodes plain text to base64 when Encode button is clicked', async () => {
      const user = userEvent.setup()
      render(<Base64 />)

      const input = screen.getByPlaceholderText(/paste your data/i)
      await user.type(input, 'Hello, World!')
      await user.click(screen.getByRole('button', { name: /^encode$/i }))

      // Check that Result section appears with encoded value
      expect(screen.getByText('SGVsbG8sIFdvcmxkIQ==')).toBeInTheDocument()
    })

    it('encodes inline - replaces input with encoded value', async () => {
      const user = userEvent.setup()
      render(<Base64 />)

      const input = screen.getByPlaceholderText(/paste your data/i)
      await user.type(input, 'test')
      await user.click(screen.getByRole('button', { name: /encode inline/i }))

      // Input should now contain the base64 encoded value
      expect(input).toHaveValue('dGVzdA==')
    })

    it('clears input and output when Clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<Base64 />)

      const input = screen.getByPlaceholderText(/paste your data/i)
      await user.type(input, 'Hello')
      await user.click(screen.getByRole('button', { name: /^encode$/i }))

      // Verify output exists
      expect(screen.getByText('SGVsbG8=')).toBeInTheDocument()

      // Click clear
      await user.click(screen.getByRole('button', { name: /clear/i }))

      // Input should be empty and output should be gone
      expect(input).toHaveValue('')
      expect(screen.queryByText('SGVsbG8=')).not.toBeInTheDocument()
    })
  })

  describe('Decoder', () => {
    it('renders decoder tab when clicked', async () => {
      const user = userEvent.setup()
      render(<Base64 />)

      // Click on Decoder tab
      await user.click(screen.getByRole('tab', { name: /decoder/i }))

      expect(screen.getByPlaceholderText(/paste your base64 encoded data/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^decode$/i })).toBeInTheDocument()
    })

    it('decodes base64 to plain text when Decode button is clicked', async () => {
      const user = userEvent.setup()
      render(<Base64 />)

      // Switch to decoder tab
      await user.click(screen.getByRole('tab', { name: /decoder/i }))

      const input = screen.getByPlaceholderText(/paste your base64 encoded data/i)
      await user.type(input, 'SGVsbG8sIFdvcmxkIQ==')
      await user.click(screen.getByRole('button', { name: /^decode$/i }))

      // Check decoded output appears
      expect(screen.getByText('Hello, World!')).toBeInTheDocument()
    })

    it('decodes inline - replaces input with decoded value', async () => {
      const user = userEvent.setup()
      render(<Base64 />)

      // Switch to decoder tab
      await user.click(screen.getByRole('tab', { name: /decoder/i }))

      const input = screen.getByPlaceholderText(/paste your base64 encoded data/i)
      await user.type(input, 'dGVzdA==')
      await user.click(screen.getByRole('button', { name: /decode inline/i }))

      // Input should now contain the decoded value
      expect(input).toHaveValue('test')
    })

    it('clears input and output when Clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<Base64 />)

      // Switch to decoder tab
      await user.click(screen.getByRole('tab', { name: /decoder/i }))

      const input = screen.getByPlaceholderText(/paste your base64 encoded data/i)
      await user.type(input, 'SGVsbG8=')
      await user.click(screen.getByRole('button', { name: /^decode$/i }))

      // Verify output exists
      expect(screen.getByText('Hello')).toBeInTheDocument()

      // Click clear
      await user.click(screen.getByRole('button', { name: /clear/i }))

      // Input should be empty and output should be gone
      expect(input).toHaveValue('')
      expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    })
  })

  describe('Tab Navigation', () => {
    it('can switch between Encoder and Decoder tabs', async () => {
      const user = userEvent.setup()
      render(<Base64 />)

      // Initially on Encoder tab
      expect(screen.getByPlaceholderText(/paste your data/i)).toBeInTheDocument()

      // Switch to Decoder
      await user.click(screen.getByRole('tab', { name: /decoder/i }))
      expect(screen.getByPlaceholderText(/paste your base64 encoded data/i)).toBeInTheDocument()

      // Switch back to Encoder
      await user.click(screen.getByRole('tab', { name: /encoder/i }))
      expect(screen.getByPlaceholderText(/paste your data/i)).toBeInTheDocument()
    })
  })
})
