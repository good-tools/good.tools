import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { type Block, bodySize, type PageInput, reconstruct, type TextItem, toDocx } from './pdf-word'

/** One text item per line, ~0.5 pt per character wide per point of font size. */
const line = (str: string, y: number, o: Partial<TextItem> = {}): TextItem => ({
  str,
  x: 72,
  y,
  width: str.length * (o.size ?? 10) * 0.5,
  size: 10,
  ...o,
})
const page = (items: TextItem[], images: PageInput['images'] = []): PageInput => ({
  width: 612,
  height: 792,
  items,
  images,
})
const full = 'x'.repeat(90) // reaches the right edge
/** Block text with line breaks as \n */
const text = (b: Block) => ('runs' in b ? b.runs : []).map((r) => (r.newLine ? '\n' : '') + r.text).join('')

describe('reconstruct', () => {
  it('ranks headings by size and joins wrapped lines into paragraphs', () => {
    const [blocks] = reconstruct([
      page([
        line('Title', 80, { size: 24 }),
        line('Section', 120, { size: 16 }),
        line(`${full} wraps`, 140),
        line('onto the next line.', 152),
        line('Second paragraph after a gap.', 180),
        line('Another section', 220, { size: 16 }),
        line('Small print', 240, { size: 12 }),
      ]),
    ])
    expect(blocks!.map((b) => [b.kind, 'level' in b ? b.level : undefined, text(b)])).toEqual([
      ['heading', 1, 'Title'],
      ['heading', 2, 'Section'],
      ['paragraph', undefined, `${full} wraps onto the next line.`],
      ['paragraph', undefined, 'Second paragraph after a gap.'],
      ['heading', 2, 'Another section'],
      ['heading', 3, 'Small print'],
    ])
  })

  it('keeps line breaks after short lines and splits on a short line ending a sentence', () => {
    const [blocks] = reconstruct([
      page([
        line(full, 100),
        line('Jane Doe', 112),
        line('1 Main Street', 124),
        line(full, 136),
        line('Ends here.', 148),
        line('New paragraph without extra spacing', 160),
        line(full, 172),
      ]),
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks![0]!.kind === 'paragraph' && blocks![0]!.runs.map((r) => [r.text, !!r.newLine])).toEqual([
      [`${full} Jane Doe`, false],
      ['1 Main Street', true],
      [`${full} Ends here.`, true],
    ])
    expect(text(blocks![1]!)).toBe(`New paragraph without extra spacing\n${full}`)
  })

  it('undoes hyphenation and merges items on one line with spaces at gaps', () => {
    const [blocks] = reconstruct([
      page([
        { str: 'Hello', x: 72, y: 100, width: 25, size: 10 },
        { str: 'world', x: 100, y: 100.3, width: 25, size: 10 },
        line(`${full} conver-`, 112),
        line('sation', 124),
      ]),
    ])
    expect(text(blocks![0]!)).toBe(`Hello world\n${full} conversation`)
  })

  it('finds bullet and numbered lists with continuation lines', () => {
    const [blocks] = reconstruct([
      page([
        line('Intro:', 100),
        { str: '•', x: 72, y: 112, width: 4, size: 10 },
        { str: `${full} first`, x: 84, y: 112, width: 500, size: 10 },
        line('continues', 124, { x: 84 }),
        line('• second', 136),
        line('1. numbered', 148),
        line('2) also numbered', 160),
        line('-5 degrees is not a bullet', 172),
      ]),
    ])
    expect(blocks!.map((b) => [b.kind, 'numbered' in b ? b.numbered : undefined, text(b)])).toEqual([
      ['paragraph', undefined, 'Intro:'],
      ['list', false, `${full} first continues`],
      ['list', false, 'second'],
      ['list', true, '1. numbered'],
      ['list', true, '2) also numbered'],
      ['paragraph', undefined, '-5 degrees is not a bullet'],
    ])
  })

  it('keeps bold and italic runs', () => {
    const [blocks] = reconstruct([
      page([
        { str: 'Plain ', x: 72, y: 100, width: 30, size: 10 },
        { str: 'bold', x: 102, y: 100, width: 20, size: 10, bold: true },
        { str: ' and ', x: 122, y: 100, width: 25, size: 10 },
        { str: 'italic', x: 147, y: 100, width: 30, size: 10, italic: true },
      ]),
    ])
    expect(blocks![0]!.kind === 'paragraph' && blocks![0]!.runs).toEqual([
      { text: 'Plain ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'italic', italic: true },
    ])
  })

  it('places images between blocks by position', () => {
    const [blocks] = reconstruct([
      page([line('Above', 100), line('Below', 400)], [{ x: 72, y: 150, width: 200, height: 200 }]),
    ])
    expect(blocks!.map((b) => b.kind)).toEqual(['paragraph', 'image', 'paragraph'])
  })

  it('scales OCR pages, whose sizes are line heights, to the body text of the rest', () => {
    const typed = page([line('Typed body text', 100)])
    const ocr = {
      ...page([
        line('Scanned Title', 80, { size: 34 }),
        line(`${full} first`, 120, { size: 17 }),
        line('second line of the paragraph.', 140, { size: 16 }),
      ]),
      ocr: true,
    }
    const [, blocks] = reconstruct([typed, ocr])
    expect(blocks!.map((b) => [b.kind, 'level' in b ? b.level : undefined, text(b)])).toEqual([
      ['heading', 1, 'Scanned Title'],
      ['paragraph', undefined, `${full} first second line of the paragraph.`],
    ])
  })

  it('uses the most common size as body text', () => {
    expect(bodySize([line('a heading', 0, { size: 20 }), line('much longer body text here', 0, { size: 9 })])).toBe(9)
  })
})

describe('toDocx', () => {
  it('writes headings, bullets, line breaks and one section per page at the page size', async () => {
    const pages = [
      page([line('Title', 80, { size: 24 }), line('• item', 120), line('body', 140)]),
      page([line('Page two', 100)]),
    ].map((p) => ({ ...p, images: [], blocks: [] as ReturnType<typeof reconstruct>[number] }))
    reconstruct(pages).forEach((b, i) => {
      pages[i]!.blocks = b
    })
    const files = unzipSync(await toDocx(pages))
    const xml = new TextDecoder().decode(files['word/document.xml'])
    expect(xml).toContain('Heading1')
    expect(xml).toContain('<w:t xml:space="preserve">item</w:t>')
    expect(xml).toContain('w:numPr')
    expect(xml.match(/<w:pgSz w:w="12240" w:h="15840"/g)).toHaveLength(2)
    expect(xml).toContain('Page two')
  })
})
