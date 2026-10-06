import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { clearToolState } from '@/hooks/useToolState'
import LoremIpsum from './LoremIpsum'

beforeEach(clearToolState)

const output = () => (screen.getByLabelText('Lorem ipsum') as HTMLTextAreaElement).value

it('generates paragraphs, words and formats', async () => {
  const user = userEvent.setup()
  render(<LoremIpsum />)
  expect(output().split('\n')).toHaveLength(3)
  expect(output().startsWith('Lorem ipsum dolor sit amet')).toBe(true)

  await user.click(screen.getByRole('radio', { name: 'HTML' }))
  expect(output().match(/<p>/g)).toHaveLength(3)
  await user.click(screen.getByRole('radio', { name: 'Markdown' }))
  expect(output().split('\n\n')).toHaveLength(3)

  const count = screen.getByLabelText('Count')
  await user.clear(count)
  await user.type(count, '12')
  await user.click(screen.getByRole('radio', { name: 'Words' }))
  expect(output().split(' ')).toHaveLength(12)
  expect(screen.getByText(/12 words/)).toBeInTheDocument()

  await user.click(screen.getByRole('checkbox', { name: /start with/i }))
  expect(output().startsWith('Lorem ipsum dolor sit amet')).toBe(false)
  expect(output().split(' ')).toHaveLength(12)
  await user.click(screen.getByRole('button', { name: /regenerate/i }))
  expect(output().split(' ')).toHaveLength(12)
})
