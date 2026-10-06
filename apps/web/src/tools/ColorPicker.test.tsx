import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearToolState } from '@/hooks/useToolState'
import ColorPicker from './ColorPicker'

beforeEach(clearToolState)

describe('ColorPicker', () => {
  it('converts the typed color and checks contrast', async () => {
    render(<ColorPicker />)
    const input = screen.getByLabelText('Color')
    await userEvent.clear(input)
    await userEvent.type(input, 'rebeccapurple')
    expect(screen.getByText('#663399')).toBeInTheDocument()
    expect(screen.getByText('hsl(270 50% 40%)')).toBeInTheDocument()
    expect(screen.getByLabelText('Color picker')).toHaveValue('#663399')

    const bg = screen.getByLabelText('Background')
    await userEvent.clear(bg)
    await userEvent.type(bg, 'black')
    expect(screen.getByTestId('ratio')).toHaveTextContent('2.49:1')
    expect(screen.getAllByText(/Fail/)).toHaveLength(4)

    await userEvent.clear(input)
    await userEvent.type(input, 'nope')
    expect(screen.getByRole('alert')).toHaveTextContent('Not a CSS color')
  })

  it('keeps alpha from the native picker and sets the color from the tints strip', async () => {
    render(<ColorPicker />)
    await userEvent.clear(screen.getByLabelText('Color'))
    await userEvent.type(screen.getByLabelText('Color'), '#ff000080')
    fireEvent.input(screen.getByLabelText('Color picker'), { target: { value: '#00ff00' } })
    expect(screen.getByLabelText('Color')).toHaveValue('#00ff0080')

    const swatches = screen.getAllByRole('button', { name: /^Use #/ })
    expect(swatches).toHaveLength(11)
    const lightest = swatches[0]!.title
    await userEvent.click(swatches[0]!)
    expect(screen.getByLabelText('Color')).toHaveValue(lightest)
  })
})
