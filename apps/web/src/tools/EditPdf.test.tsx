import { PDFDocument } from '@cantoo/pdf-lib'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EditPdf from './EditPdf'

// pdf.js needs a real canvas and worker; the pages show a spinner instead
vi.mock('@/lib/pdf-render', () => ({ renderPages: async () => {} }))

async function pdf(pages: number) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([200, 300])
  return new File([(await doc.save()) as BlobPart], 'report.pdf', { type: 'application/pdf' })
}

describe('EditPdf', () => {
  it('opens a PDF, places text on a page and deletes it', async () => {
    const { container } = render(<EditPdf />)
    await userEvent.upload(container.querySelector('input[type=file]') as HTMLInputElement, await pdf(2))
    expect(await screen.findByRole('group', { name: 'Page 2' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Text' }))
    fireEvent.pointerDown(screen.getByRole('group', { name: 'Page 1' }), { button: 0 })
    expect(screen.getByRole('button', { name: /^Text "Text"/ })).toBeInTheDocument()

    const text = screen.getByLabelText('Text')
    await userEvent.clear(text)
    await userEvent.type(text, 'Signed')
    expect(screen.getByRole('button', { name: /^Text "Signed"/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByRole('button', { name: /^Text "/ })).not.toBeInTheDocument()
  })

  it('previews page numbers', async () => {
    const { container } = render(<EditPdf />)
    await userEvent.upload(container.querySelector('input[type=file]') as HTMLInputElement, await pdf(3))
    await userEvent.click(await screen.findByLabelText('Page numbers'))
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
  })
})
