import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { clearToolState } from '@/hooks/useToolState'
import WordCounter from './WordCounter'

beforeEach(clearToolState)

const stat = (label: string) => screen.getByText(label).nextElementSibling?.textContent

it('updates stats and keywords as you type, and clears', async () => {
  const user = userEvent.setup()
  render(<WordCounter />)
  await user.type(screen.getByLabelText('Text'), 'The cat sat. The cat ran. The end.')
  expect(stat('Words')).toBe('8')
  expect(stat('Sentences')).toBe('3')
  expect(stat('Characters')).toBe('34')
  expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('cat2')
  await user.click(screen.getByRole('checkbox', { name: /exclude stop words/i }))
  expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('the3')
  await user.click(screen.getByRole('radio', { name: '2 words' }))
  expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('the cat2')
  await user.click(screen.getByRole('button', { name: /clear/i }))
  expect(stat('Words')).toBe('0')
  expect(screen.getByText(/keywords appear here/i)).toBeInTheDocument()
})
