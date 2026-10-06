import { PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import type { Rect } from './pdf'
import { inkBounds, type PageBox, signPdf, stripWhite, toPdfPlacement, viewSize } from './sign-pdf'

/** Where a drawn image ends up on screen: rotate its corners in PDF space, then apply the page's /Rotate. */
function shownAt(r: Rect, p: PageBox): Rect {
  const o = toPdfPlacement(r, p)
  const a = (o.rotate.angle * Math.PI) / 180
  const corners = [
    [0, 0],
    [o.width, 0],
    [0, o.height],
    [o.width, o.height],
  ].map(([lx, ly]) => {
    // Unrotated page space, relative to the crop box
    const u = o.x - p.x + lx! * Math.cos(a) - ly! * Math.sin(a)
    const v = o.y - p.y + lx! * Math.sin(a) + ly! * Math.cos(a)
    // Displayed, bottom-left origin: the page turns clockwise by /Rotate
    const rot = ((p.rotation % 360) + 360) % 360
    return rot === 90
      ? [v, p.width - u]
      : rot === 180
        ? [p.width - u, p.height - v]
        : rot === 270
          ? [p.height - v, u]
          : [u, v]
  })
  const xs = corners.map((c) => c[0]!)
  const ys = corners.map((c) => c[1]!)
  const round = (n: number) => Math.round(n * 1000) / 1000
  return {
    x: round(Math.min(...xs)),
    y: round(Math.min(...ys)),
    width: round(Math.max(...xs) - Math.min(...xs)),
    height: round(Math.max(...ys) - Math.min(...ys)),
  }
}

const page = (rotation: number): PageBox => ({ x: 10, y: 20, width: 600, height: 800, rotation })
const rect = { x: 50, y: 100, width: 150, height: 40 }

describe('toPdfPlacement', () => {
  it('draws upright where the reader sees it, at every page rotation and with a shifted crop box', () => {
    for (const rotation of [0, 90, 180, 270, -90, 450]) expect(shownAt(rect, page(rotation))).toEqual(rect)
  })

  it('turns the image against the page rotation', () => {
    expect(toPdfPlacement(rect, page(0))).toMatchObject({ x: 60, y: 120, rotate: { angle: 0 } })
    expect(toPdfPlacement(rect, page(90))).toMatchObject({ x: 10 + 600 - 100, y: 20 + 50, rotate: { angle: 90 } })
  })

  it('swaps the displayed size at 90° and 270°', () => {
    expect(viewSize(page(90))).toEqual({ width: 800, height: 600 })
    expect(viewSize(page(180))).toEqual({ width: 600, height: 800 })
  })
})

const pixels = (width: number, height: number, rgba: number[][]) => ({
  width,
  height,
  data: new Uint8ClampedArray(rgba.flat()),
})

describe('inkBounds', () => {
  it('finds the box around opaque pixels', () => {
    const clear = [0, 0, 0, 0]
    const ink = [0, 0, 0, 255]
    expect(inkBounds(pixels(3, 3, [clear, clear, clear, clear, ink, ink, clear, clear, clear]))).toEqual({
      x: 1,
      y: 1,
      width: 2,
      height: 1,
    })
    expect(inkBounds(pixels(2, 1, [clear, clear]))).toBeNull()
  })
})

describe('stripWhite', () => {
  it('clears paper, keeps ink and fades what is in between', () => {
    const px = pixels(3, 1, [
      [250, 248, 245, 255],
      [20, 30, 120, 255],
      [180, 180, 180, 255],
    ])
    stripWhite(px)
    expect([px.data[3], px.data[7], px.data[11]]).toEqual([0, 255, 128])
  })
})

// 1×1 opaque black PNG
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

describe('signPdf', () => {
  it('draws each placement on its page and embeds a reused image once', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([600, 800])
    doc.addPage([600, 800]).setRotation({ type: 'degrees', angle: 90 } as never)
    const out = await signPdf(doc, [
      { id: 'a', page: 0, src: PNG, rect },
      { id: 'b', page: 1, src: PNG, rect },
      { id: 'c', page: 1, src: PNG, rect: { ...rect, x: 300 } },
    ])
    const signed = await PDFDocument.load(out)
    expect(signed.getPageCount()).toBe(2)
    const text = new TextDecoder('latin1').decode(out)
    // One image plus its soft mask (pdf-lib always writes the alpha channel), not one per placement
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(2)
  })
})
