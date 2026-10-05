import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useToolState } from './useToolState'

function Field({ k = 'test:field' }: { k?: string }) {
  const [v, setV] = useToolState(k, 'initial')
  return <input aria-label='f' value={v} onChange={(e) => setV(e.target.value)} />
}

test('value survives unmount and remount', async () => {
  const { unmount } = render(<Field />)
  await userEvent.type(screen.getByLabelText('f'), '!')
  unmount()
  render(<Field />)
  expect(screen.getByLabelText('f')).toHaveValue('initial!')
})

test('keys are independent', async () => {
  const { unmount } = render(<Field />)
  await userEvent.type(screen.getByLabelText('f'), '!')
  unmount()
  render(<Field k='other:field' />)
  expect(screen.getByLabelText('f')).toHaveValue('initial')
})
