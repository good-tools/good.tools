import { degrees, PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  type LayoutOptions,
  layoutPages,
  mergePdfs,
  mm,
  moveRect,
  organizePdf,
  PAGE_SIZES,
  parsePageRange,
  resizeRect,
  targetPixels,
} from './pdf'

const a4: LayoutOptions = { pageSize: 'a4', landscape: false, perPage: 2, margin: 0, size: 'fit' }
const card = { width: 1000, height: 630 }

async function blank(pages: number, width = 200) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([width, 300])
  return doc.save()
}

describe('layoutPages', () => {
  it('stacks two images per portrait page, top one first', () => {
    const pages = layoutPages([card, card, card], a4)
    expect(pages).toHaveLength(2)
    const [front, back] = pages[0]!.items
    expect(front!.width).toBeCloseTo(PAGE_SIZES.a4[0])
    expect(front!.y).toBeGreaterThan(back!.y)
    expect(pages[1]!.items.map((i) => i.index)).toEqual([2])
  })

  it('prints at real ID-card size, centred', () => {
    const { items } = layoutPages([card], { ...a4, perPage: 1, size: 'card' })[0]!
    expect(items[0]!.width).toBeCloseTo(mm(85.6))
    expect(items[0]!.x + items[0]!.width / 2).toBeCloseTo(PAGE_SIZES.a4[0] / 2)
  })

  it('turns the card box for portrait photos and never overflows the cell', () => {
    const { items } = layoutPages([{ width: 630, height: 1000 }], { ...a4, perPage: 6, size: 'card' })[0]!
    expect(items[0]!.height).toBeCloseTo(mm(85.6))
    const tiny = layoutPages([card], {
      ...a4,
      pageSize: 'a5',
      perPage: 6,
      landscape: true,
      margin: 100,
      size: 'card',
    })[0]!
    expect(tiny.items[0]!.width).toBeLessThan(mm(85.6))
  })

  it('sizes the page to each image in fit mode', () => {
    const pages = layoutPages([card], { ...a4, pageSize: 'fit', margin: 10 })
    expect(pages[0]).toMatchObject({ width: 770, height: 492.5, items: [{ x: 10, y: 10, width: 750 }] })
  })
})

describe('pdf operations', () => {
  it('merges in the given order', async () => {
    const merged = await PDFDocument.load(await mergePdfs([await blank(2, 100), await blank(1, 200)]))
    expect(merged.getPages().map((p) => p.getWidth())).toEqual([100, 100, 200])
  })
})

describe('placement', () => {
  const page = { width: 600, height: 800 }
  const r = { x: 100, y: 100, width: 200, height: 100 }

  it('moves with screen-down dy and stays on the page', () => {
    expect(moveRect(r, 10, 20, page)).toEqual({ ...r, x: 110, y: 80 })
    expect(moveRect(r, -500, 5000, page)).toEqual({ ...r, x: 0, y: 0 })
    expect(moveRect(r, 5000, -5000, page)).toEqual({ ...r, x: 400, y: 700 })
  })

  it('resizes keeping ratio and the top-left corner, capped by the page edge', () => {
    expect(resizeRect(r, 100, page)).toEqual({ x: 100, y: 50, width: 300, height: 150 })
    expect(resizeRect(r, 10_000, page).width).toBe(400) // right edge
    expect(resizeRect(r, 10_000, { width: 10_000, height: 800 })).toMatchObject({ y: 0, height: 200 }) // bottom
    expect(resizeRect(r, -10_000, page).width).toBeCloseTo(mm(5))
  })
})

describe('targetPixels', () => {
  it('downsamples to the printed size and never upscales', () => {
    const photo = { width: 4000, height: 3000 }
    // 3 inches wide at 300 dpi
    expect(targetPixels(photo, { x: 0, y: 0, width: 216, height: 162 }, 300)).toEqual({ width: 900, height: 675 })
    expect(targetPixels(photo, { x: 0, y: 0, width: 216, height: 162 }, Number.POSITIVE_INFINITY)).toEqual(photo)
    expect(targetPixels({ width: 100, height: 50 }, { x: 0, y: 0, width: 500, height: 250 }, 300)).toEqual({
      width: 100,
      height: 50,
    })
  })
})

describe('parsePageRange', () => {
  it('parses pages and ranges in the order given, 0-based, without repeats', () => {
    expect(parsePageRange('1-3,7', 10)).toEqual([0, 1, 2, 6])
    expect(parsePageRange(' 7 , 2 - 3, 2 ', 10)).toEqual([6, 1, 2])
    expect(parsePageRange('9-', 10)).toEqual([8, 9])
    expect(parsePageRange('3-1', 10)).toEqual([2, 1, 0])
    expect(parsePageRange('1,,2,', 2)).toEqual([0, 1])
  })

  it('rejects malformed, empty and out-of-range input', () => {
    for (const bad of ['', ' , ', 'a', '1-2-3', '-3', '0', '11', '2-11', '1.5'])
      expect(() => parsePageRange(bad, 10), bad).toThrow()
  })
})

describe('organizePdf', () => {
  /** Pages told apart by width: page n is 100 + n points wide */
  async function numbered(pages: number) {
    const doc = await PDFDocument.create()
    for (let i = 0; i < pages; i++) doc.addPage([100 + i, 300]).setRotation(degrees(i === 1 ? 90 : 0))
    return doc.save()
  }
  const summary = async (bytes: Uint8Array) =>
    (await PDFDocument.load(bytes)).getPages().map((p) => [p.getWidth() - 100, p.getRotation().angle])

  it('reorders, drops and rotates on top of the existing rotation', async () => {
    const out = await organizePdf(await numbered(4), [
      { index: 3, rotation: 0 },
      { index: 1, rotation: 270 },
      { index: 0, rotation: -90 },
    ])
    expect(await summary(out)).toEqual([
      [3, 0],
      [1, 0],
      [0, 270],
    ])
  })

  it('can repeat a page', async () => {
    expect(
      await summary(
        await organizePdf(
          await numbered(2),
          [0, 0].map((index) => ({ index, rotation: 180 })),
        ),
      ),
    ).toEqual([
      [0, 180],
      [0, 180],
    ])
  })
})
