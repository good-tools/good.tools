import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PdfToImages from './PdfToImages'

// pdf.js needs a real canvas; a two-page fake behind an open password is enough for the UI
vi.mock('pdfjs-dist', () => {
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 612 * scale, height: 792 * scale }),
    render: () => ({ promise: Promise.resolve() }),
    cleanup: () => {},
  }
  return {
    GlobalWorkerOptions: {},
    PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 },
    getDocument: ({ password }: { password: string }) => ({
      promise:
        password === 'secret'
          ? Promise.resolve({ numPages: 2, getPage: async () => page })
          : Promise.reject(
              Object.assign(new Error('No password given'), { name: 'PasswordException', code: password ? 2 : 1 }),
            ),
      destroy: async () => {},
    }),
  }
})

beforeEach(() => {
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,'
})

const drop = () =>
  fireEvent.change(document.querySelector('input[type=file]')!, {
    target: { files: [new File(['%PDF-1.7'], 'scan.pdf', { type: 'application/pdf' })] },
  })

describe('PdfToImages', () => {
  it('asks for the password, then shows selectable pages and format options', async () => {
    render(<PdfToImages />)
    drop()
    expect(await screen.findByText('This PDF needs a password')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('PDF password'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByText('Wrong password')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('PDF password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByText('Download 2 pages (.zip)')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: 'Select page 1' }))
    expect(screen.getByRole('button', { name: 'Select page 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Download page')).toBeInTheDocument()
    expect(screen.getByText('scan.pdf · 1 of 2 pages selected')).toBeInTheDocument()

    // Quality only applies to lossy formats
    expect(screen.getByLabelText('Quality')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }))
    expect(screen.queryByLabelText('Quality')).not.toBeInTheDocument()
  })
})
