import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CertToolkit from './CertToolkit'

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('CertToolkit', () => {
  it('generates a CSR and a private key', async () => {
    render(<CertToolkit />)
    type('Common name (CN)', 'example.com')
    type(/Subject alternative names/, 'example.com, 10.0.0.1')
    fireEvent.click(screen.getByRole('button', { name: /Create CSR/ }))
    await waitFor(
      () => expect((screen.getByLabelText('CSR') as HTMLTextAreaElement).value).toMatch(/BEGIN CERTIFICATE REQUEST/),
      { timeout: 10_000 },
    )
    expect((screen.getByLabelText('Private key') as HTMLTextAreaElement).value).toMatch(/BEGIN PRIVATE KEY/)
  }, 20_000)

  it('reports a bad SAN', async () => {
    render(<CertToolkit />)
    type(/Subject alternative names/, 'not valid!')
    fireEvent.click(screen.getByRole('button', { name: /Create CSR/ }))
    expect(await screen.findByRole('alert', {}, { timeout: 10_000 })).toHaveTextContent(/not a valid DNS name/)
  }, 20_000)
})
