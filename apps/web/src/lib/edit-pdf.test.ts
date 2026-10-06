import { decodePDFRawStream, degrees, PDFArray, PDFDocument, type PDFPage, PDFRawStream } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  editPdf,
  type Item,
  moveBox,
  type PageNumbers,
  pageFrame,
  pageLabel,
  resizeBox,
  type Watermark,
} from './edit-pdf'

const crop = { x: 0, y: 0, width: 200, height: 300 }

describe('pageFrame', () => {
  it('maps the top-left view to PDF coordinates for each page rotation', () => {
    expect(pageFrame(crop, 0)).toMatchObject({ width: 200, height: 300 })
    expect(pageFrame(crop, 0).at(10, 20)).toEqual({ x: 10, y: 280 })
    // Shown turned clockwise: the page's top-left corner is at the view's top-right
    const r90 = pageFrame(crop, 90)
    expect(r90).toMatchObject({ width: 300, height: 200 })
    expect(r90.at(300, 0)).toEqual({ x: 0, y: 300 })
    expect(r90.at(0, 200)).toEqual({ x: 200, y: 0 })
    expect(pageFrame(crop, 180).at(0, 0)).toEqual({ x: 200, y: 0 })
    expect(pageFrame(crop, -90).at(0, 0)).toEqual({ x: 200, y: 300 })
    expect(pageFrame(crop, 270).at(300, 200)).toEqual({ x: 0, y: 0 })
    expect(r90.rotate(15).angle).toBe(105)
  })

  it('offsets by the crop box origin', () => {
    expect(pageFrame({ ...crop, x: 5, y: 7 }, 0).at(0, 300)).toEqual({ x: 5, y: 7 })
  })
})

describe('pageLabel', () => {
  it('fills {n} and {total}, counting from the start number', () => {
    expect(pageLabel('Page {n} of {total}', 0, 3, 1)).toBe('Page 1 of 3')
    expect(pageLabel('{n}/{total} · {n}', 2, 3, 5)).toBe('7/7 · 7')
  })
})

describe('moveBox and resizeBox', () => {
  const page = { width: 200, height: 300 }
  const box = { id: 'a', page: 0, x: 10, y: 10, width: 50, height: 20 }

  it('moves with screen-down dy and stays on the page', () => {
    expect(moveBox(box, 5, 5, page)).toMatchObject({ x: 15, y: 15 })
    expect(moveBox(box, -100, 1000, page)).toMatchObject({ x: 0, y: 280 })
  })

  it('resizes freely or keeping the ratio, within the page', () => {
    expect(resizeBox(box, 10, -100, page, false)).toMatchObject({ width: 60, height: 4 })
    expect(resizeBox(box, 1000, 0, page, false)).toMatchObject({ width: 190 })
    expect(resizeBox(box, 50, 0, page, true)).toMatchObject({ width: 100, height: 40 })
  })
})

/** Decoded content streams of a page */
function content(page: PDFPage) {
  const c = page.node.Contents()
  const streams = c instanceof PDFArray ? c.asArray().map((r) => page.doc.context.lookup(r)) : [c]
  return streams
    .filter((s) => s instanceof PDFRawStream)
    .map((s) => new TextDecoder().decode(decodePDFRawStream(s).decode()))
    .join('\n')
}
/** pdf-lib writes standard-font text as hex strings */
const hex = (s: string) =>
  `<${[...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join('')}>`

const off: Watermark = { enabled: false, text: '', size: 40, opacity: 0.2, rotation: 45, color: '#ff0000' }
const noNumbers: PageNumbers = { enabled: false, format: '{n}', start: 1, position: 'bottom-center', size: 10 }

describe('editPdf', () => {
  it('draws items on their page, a watermark and page numbers on every page', async () => {
    const src = await PDFDocument.create()
    src.addPage([200, 300])
    src.addPage([200, 300]).setRotation(degrees(90))
    const items: Item[] = [
      {
        id: '1',
        page: 0,
        x: 10,
        y: 10,
        width: 0,
        height: 0,
        kind: 'text',
        text: 'Hello\nWorld',
        size: 12,
        color: '#000000',
        font: 'times',
      },
      { id: '2', page: 1, x: 10, y: 10, width: 50, height: 20, kind: 'whiteout' },
      { id: '3', page: 1, x: 10, y: 50, width: 50, height: 20, kind: 'highlight' },
    ]
    const out = await PDFDocument.load(
      await editPdf(
        await src.save(),
        items,
        { ...off, enabled: true, text: 'DRAFT' },
        { ...noNumbers, enabled: true, format: 'Page {n} of {total}' },
      ),
    )
    const [p1, p2] = out.getPages().map(content)
    expect(p1).toContain(hex('Hello'))
    expect(p1).toContain(hex('World'))
    expect(p1).not.toMatch(/^f$/m) // no filled rectangles on page 1
    expect(p2).not.toContain(hex('Hello'))
    expect(p2?.match(/^f$/gm)).toHaveLength(2)
    for (const [i, c] of [p1, p2].entries()) {
      expect(c).toContain(hex('DRAFT'))
      expect(c).toContain(hex(`Page ${i + 1} of 2`))
    }
    expect(out.getPage(1).getRotation().angle).toBe(90)
  })

  it('leaves the PDF unchanged in content when there is nothing to add', async () => {
    const src = await PDFDocument.create()
    src.addPage([200, 300])
    const out = await PDFDocument.load(await editPdf(await src.save(), [], off, noNumbers))
    expect(out.getPageCount()).toBe(1)
    expect(content(out.getPage(0))).not.toContain('Tj')
  })
})
