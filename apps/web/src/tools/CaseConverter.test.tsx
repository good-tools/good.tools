import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { clearToolState } from '@/hooks/useToolState'
import CaseConverter from './CaseConverter'

beforeEach(clearToolState)

const row = (label: string) => screen.getByText(label).nextElementSibling?.textContent

it('shows every conversion live, per line by default', async () => {
  const user = userEvent.setup()
  render(<CaseConverter />)
  await user.type(screen.getByLabelText('Text'), 'XMLHttpRequest{enter}user id')
  expect(row('snake_case')).toBe('xml_http_request\nuser_id')
  expect(row('camelCase')).toBe('xmlHttpRequest\nuserId')
  expect(row('CONSTANT_CASE')).toBe('XML_HTTP_REQUEST\nUSER_ID')
  expect(screen.getByRole('button', { name: 'Copy kebab-case' })).toBeEnabled()
  await user.click(screen.getByRole('checkbox', { name: /per line/i }))
  expect(row('snake_case')).toBe('xml_http_request_user_id')
  await user.click(screen.getByRole('button', { name: /clear/i }))
  expect(row('snake_case')).toBe('')
  expect(screen.getByRole('button', { name: 'Copy kebab-case' })).toBeDisabled()
})
