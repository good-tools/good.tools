import { PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { type LayoutOptions, layoutPages, mergePdfs, mm, moveRect, PAGE_SIZES, resizeRect, targetPixels } from './pdf'

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
