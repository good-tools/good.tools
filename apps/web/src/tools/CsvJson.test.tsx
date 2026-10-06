import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { clearToolState } from '@/hooks/useToolState'
import CsvJson from './CsvJson'

beforeEach(clearToolState)

it('converts CSV to JSON live, then swaps to JSON → CSV', async () => {
  const user = userEvent.setup()
  render(<CsvJson />)
  fireEvent.change(screen.getByLabelText('CSV input'), { target: { value: 'name,n\nAda,1\n' } })
  expect(screen.getByText('1 row · 2 cols')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: 'JSON' }))
  expect(JSON.parse((screen.getByLabelText('JSON output') as HTMLTextAreaElement).value)).toEqual([
    { name: 'Ada', n: 1 },
  ])

  await user.click(screen.getByRole('checkbox', { name: 'Infer types' }))
  expect(screen.getByLabelText('JSON output')).toHaveValue('[\n  {\n    "name": "Ada",\n    "n": "1"\n  }\n]')

  await user.click(screen.getByRole('button', { name: 'Swap direction' }))
  expect(screen.getByRole('radio', { name: 'JSON → CSV' })).toHaveAttribute('aria-checked', 'true')
  await user.click(screen.getByRole('radio', { name: 'CSV' }))
  expect(screen.getByLabelText('CSV output')).toHaveValue('name,n\nAda,1')
})

it('flags JSON it cannot tabulate', () => {
  render(<CsvJson />)
  fireEvent.click(screen.getByRole('radio', { name: 'JSON → CSV' }))
  fireEvent.change(screen.getByLabelText('JSON input'), { target: { value: '[1, 2]' } })
  expect(screen.getByRole('alert')).toHaveTextContent(/array of objects/)
})
