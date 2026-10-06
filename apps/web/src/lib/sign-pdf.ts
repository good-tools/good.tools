import { degrees, type PDFDocument } from '@cantoo/pdf-lib'
import type { Rect } from '@/lib/pdf'

/** A page as the reader sees it: rotation applied, in points. */
export interface PageBox {
  /** Crop box in unrotated PDF space */
  x: number
  y: number
  width: number
  height: number
  /** The page's /Rotate, clockwise degrees */
  rotation: number
}

/** Size of the page as displayed (width and height swap at 90° and 270°). */
export const viewSize = (p: PageBox) =>
  normalize(p.rotation) % 180 ? { width: p.height, height: p.width } : { width: p.width, height: p.height }

const normalize = (deg: number) => (((Math.round(deg / 90) * 90) % 360) + 360) % 360

/**
 * `drawImage` options that put an upright image at `r` on the page as displayed (bottom-left origin, like
 * `Rect`), on a page that may be rotated or have a crop box that doesn't start at 0,0.
 */
export function toPdfPlacement(r: Rect, p: PageBox) {
  const rot = normalize(p.rotation)
  // The image's bottom-left corner in unrotated page space; the content is then turned against /Rotate
  const [u, v] =
    rot === 90
      ? [p.width - r.y, r.x]
      : rot === 180
        ? [p.width - r.x, p.height - r.y]
        : rot === 270
          ? [r.y, p.height - r.x]
          : [r.x, r.y]
  return { x: p.x + u, y: p.y + v, width: r.width, height: r.height, rotate: degrees(rot) }
}

export interface Placement {
  id: string
  /** 0-based page */
  page: number
  /** PNG data URL */
  src: string
  rect: Rect
}

/** Draws every placement onto `doc` (embedding each distinct image once) and returns the saved PDF. */
export async function signPdf(doc: PDFDocument, placements: Placement[]): Promise<Uint8Array> {
  const embedded = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>()
  for (const { page, src, rect } of placements) {
    const img = embedded.get(src) ?? (await doc.embedPng(src))
    embedded.set(src, img)
    const p = doc.getPage(page)
    const box = p.getCropBox()
    p.drawImage(img, toPdfPlacement(rect, { ...box, rotation: p.getRotation().angle }))
  }
  return doc.save()
}

interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Smallest box holding every pixel with some opacity, or null if there are none. */
export function inkBounds({ data, width, height }: Pixels): Rect | null {
  let [x0, y0, x1, y1] = [width, height, -1, -1]
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

/**
 * Makes near-white pixels transparent, in place, so a photographed signature sits on the page without a box.
 * Pixels at or above `cut` brightness vanish; darker ones keep their opacity, with a soft edge in between.
 */
export function stripWhite({ data }: Pixels, cut = 200) {
  const soft = 40
  for (let i = 0; i < data.length; i += 4) {
    const light = Math.min(data[i]!, data[i + 1]!, data[i + 2]!)
    const keep = Math.max(0, Math.min(1, (cut - light) / soft))
    data[i + 3] = Math.round(data[i + 3]! * keep)
  }
}
