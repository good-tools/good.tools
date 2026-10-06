import { describe, expect, it } from 'vitest'
import { printCss, rejectReason } from './word-to-pdf'

const zip = new Uint8Array([0x50, 0x4b, 3, 4])

describe('rejectReason', () => {
  it('accepts Word OOXML files that are ZIPs', () => {
    expect(rejectReason('Report.DOCX', zip)).toBeNull()
    expect(rejectReason('template.dotx', zip)).toBeNull()
  })

  it('explains unsupported formats', () => {
    expect(rejectReason('old.doc', zip)).toMatch(/97–2003/)
    expect(rejectReason('a.odt', zip)).toMatch(/\.odt files are not supported/)
    expect(rejectReason('a.rtf', zip)).toMatch(/\.rtf files are not supported/)
    expect(rejectReason('a.pdf', zip)).toMatch(/not a Word document/)
    expect(rejectReason('fake.docx', new TextEncoder().encode('hello'))).toMatch(/not a valid \.docx/)
  })
})

describe('printCss', () => {
  it('names one @page per distinct paper size', () => {
    const a4 = { width: '595.3pt', height: '841.9pt' }
    const land = { width: '841.9pt', height: '595.3pt' }
    const { css, names } = printCss([a4, a4, land, { width: '', height: '' }, a4])
    expect(names).toEqual(['p0', 'p0', 'p1', '', 'p0'])
    expect(css).toContain('@page p0 { size: 595.3pt 841.9pt; margin: 0 }')
    expect(css).toContain('@page p1 { size: 841.9pt 595.3pt; margin: 0 }')
    expect(css).toContain('box-decoration-break: clone')
  })
})
