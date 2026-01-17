import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton, CodeGroup } from './Code'

describe('Code Component', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('CopyButton', () => {
    it('renders with Copy text initially', () => {
      render(<CopyButton code='test content' />)
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })

    it('copies code to clipboard when clicked and shows Copied! state', async () => {
      const user = userEvent.setup()

      render(<CopyButton code='Hello, World!' />)

      // Initially shows "Copy"
      expect(screen.getByText('Copy')).toBeInTheDocument()

      await user.click(screen.getByRole('button'))

      // After clicking, should show "Copied!" which proves clipboard.writeText was called and resolved
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })

    it('resets to Copy text after timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(<CopyButton code='test' />)

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })

      // Advance time by 1 second (the timeout in the component)
      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        expect(screen.getByText('Copy')).toHaveAttribute('aria-hidden', 'false')
      })

      vi.useRealTimers()
    })
  })

  describe('CodeGroup', () => {
    it('renders with title', () => {
      render(
        <CodeGroup title='Result'>
          <code>test content</code>
        </CodeGroup>,
      )
      expect(screen.getByText('Result')).toBeInTheDocument()
    })

    it('renders code content', () => {
      render(
        <CodeGroup title='Example'>
          <code>console.log("hello")</code>
        </CodeGroup>,
      )
      expect(screen.getByText('console.log("hello")')).toBeInTheDocument()
    })

    it('includes a copy button that works', async () => {
      const user = userEvent.setup()

      render(
        <CodeGroup title='Code'>
          <code>test code</code>
        </CodeGroup>,
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Copy')).toBeInTheDocument()

      // Click the copy button and verify it shows Copied! state
      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })
  })
})
