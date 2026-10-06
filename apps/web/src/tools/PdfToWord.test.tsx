import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PdfToWord from './PdfToWord'

// A one-page fake behind an open password: a large title, a bold run and a bullet
vi.mock('pdfjs-dist', () => {
  const item = (str: string, x: number, y: number, size: number, fontName = 'g_regular') => ({
    str,
    transform: [size, 0, 0, size, x, 792 - y],
    width: str.length * size * 0.5,
    fontName,
  })
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({
      width: 612 * scale,
      height: 792 * scale,
      convertToViewportPoint: (x: number, y: number) => [x, 792 - y],
    }),
    getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
    getTextContent: async () => ({
      items: [
        item('Annual Report', 72, 80, 24),
        item('Revenue grew ', 72, 120, 10),
        item('fast', 137, 120, 10, 'g_bold'),
        item('• Lower costs', 72, 140, 10),
      ],
    }),
    commonObjs: { get: (id: string) => ({ bold: id === 'g_bold' }) },
    objs: { get: () => null },
    cleanup: () => {},
  }
  return {
    GlobalWorkerOptions: {},
    OPS: {},
    PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 },
    getDocument: ({ password }: { password: string }) => ({
      promise:
        password === 'secret'
          ? Promise.resolve({ numPages: 1, getPage: async () => page })
          : Promise.reject(
              Object.assign(new Error('No password given'), { name: 'PasswordException', code: password ? 2 : 1 }),
            ),
      destroy: async () => {},
    }),
  }
})

describe('PdfToWord', () => {
  it('asks for the password, then previews headings, bold text and lists', async () => {
    render(<PdfToWord />)
    expect(screen.getByText(/layout is approximate/i)).toBeInTheDocument()
    fireEvent.change(document.querySelector('input[type=file]')!, {
      target: { files: [new File(['%PDF-1.7'], 'report.pdf', { type: 'application/pdf' })] },
    })
    expect(await screen.findByText('This PDF needs a password')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('PDF password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('button', { name: /Download \.docx/ })).toBeInTheDocument()

    const preview = within(screen.getByRole('region', { name: 'Page 1' }))
    expect(preview.getByRole('heading', { name: 'Annual Report' })).toBeInTheDocument()
    expect(preview.getByText('fast').tagName).toBe('STRONG')
    expect(preview.getByText('Lower costs')).toBeInTheDocument()
    expect(screen.getByText('1 heading · 1 paragraph · 1 list item · 0 images')).toBeInTheDocument()
  })
})
