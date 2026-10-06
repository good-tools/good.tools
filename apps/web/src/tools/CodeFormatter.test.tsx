import type { EditorProps } from '@monaco-editor/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import CodeFormatter from './CodeFormatter'

// Monaco doesn't run in jsdom; a textarea stands in for it
vi.mock('@/components/ui/code-editor', () => ({
  CodeEditor: ({ value, onChange, options }: EditorProps) => (
    <textarea
      aria-label={options?.ariaLabel}
      value={value}
      readOnly={options?.readOnly}
      onChange={(e) => onChange?.(e.target.value, undefined as never)}
    />
  ),
}))

const setup = () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <CodeFormatter />
    </MemoryRouter>,
  )
  return user
}

describe('CodeFormatter', { timeout: 30_000 }, () => {
  it('beautifies as you type and minifies with a size comparison', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: /example/i }))
    const out = () => (screen.getByLabelText('JavaScript output') as HTMLTextAreaElement).value
    await vi.waitFor(() => expect(out()).toContain('async function greet(id) {\n  const res'), { timeout: 10_000 })
    await user.click(screen.getByRole('radio', { name: 'Minify' }))
    await vi.waitFor(() => expect(out()).toMatch(/^async function greet\(\w\)\{[^\n]+$/), { timeout: 10_000 })
    expect(screen.getByTestId('sizes')).toHaveTextContent(/→ .*\(−\d+%\)/)
  })

  it('shows parse errors with their position', async () => {
    const user = setup()
    await user.click(screen.getByRole('radio', { name: 'CSS' }))
    await user.type(screen.getByLabelText('CSS input'), 'a {{ color: red')
    expect(await screen.findByRole('alert', {}, { timeout: 10_000 })).toHaveTextContent(/line 1, column \d+/)
    expect(screen.getByText('Fix the input to see the output')).toBeInTheDocument()
  })

  it('offers only beautify for SQL, with a dialect picker', async () => {
    const user = setup()
    await user.click(screen.getByRole('radio', { name: 'SQL' }))
    await user.selectOptions(screen.getByLabelText('SQL dialect'), 'postgresql')
    await user.click(screen.getByRole('radio', { name: 'Minify' }))
    expect(screen.getByRole('status')).toHaveTextContent(/no SQL minifier/)
  })
})
