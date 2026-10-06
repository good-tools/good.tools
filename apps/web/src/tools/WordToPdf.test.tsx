import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WordToPdf from './WordToPdf'

// docx-preview needs real layout; two A4 pages are enough for the UI
vi.mock('docx-preview', () => ({
  renderAsync: async (_data: unknown, body: HTMLElement) => {
    body.innerHTML =
      '<div class="docx-wrapper"><section class="docx" style="width:595pt;min-height:842pt">One</section><section class="docx" style="width:595pt;min-height:842pt">Two</section></div>'
  },
}))

// jsdom has no ResizeObserver
globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const drop = (file: File) =>
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } })

describe('WordToPdf', () => {
  it('rejects formats it cannot render', async () => {
    render(<WordToPdf />)
    drop(new File(['{\\rtf1}'], 'letter.rtf'))
    expect(await screen.findByText(/\.rtf files are not supported/)).toBeInTheDocument()
  })

  it('previews the pages and offers Save as PDF', async () => {
    render(<WordToPdf />)
    drop(new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'report.docx'))
    expect(await screen.findByText('Preview · 2 pages')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save as PDF/ })).toBeEnabled()
    const frame = screen.getByTitle('Document preview') as HTMLIFrameElement
    expect(frame.contentDocument?.title).toBe('report')
    expect(frame.contentDocument?.querySelector<HTMLElement>('section.docx')?.style.getPropertyValue('page')).toBe('p0')
  })
})
