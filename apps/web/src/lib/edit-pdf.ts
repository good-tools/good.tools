import { BlendMode, degrees, type PDFFont, type PDFPage, rgb, StandardFonts } from '@cantoo/pdf-lib'
import { mm, openPdf } from './pdf'

export const FONTS = {
  helvetica: { label: 'Helvetica', pdf: StandardFonts.Helvetica, css: 'Helvetica, Arial, sans-serif' },
  'helvetica-bold': { label: 'Helvetica Bold', pdf: StandardFonts.HelveticaBold, css: 'Helvetica, Arial, sans-serif' },
  times: { label: 'Times', pdf: StandardFonts.TimesRoman, css: '"Times New Roman", Times, serif' },
  courier: { label: 'Courier', pdf: StandardFonts.Courier, css: '"Courier New", Courier, monospace' },
} as const

export type FontKey = keyof typeof FONTS

/** Line height of text items, in font sizes (the preview uses the same) */
export const LINE_HEIGHT = 1.2
/** First baseline below the top of a text item, in font sizes: where CSS puts it with LINE_HEIGHT */
export const BASELINE = 0.93

/** Highlighter yellow, multiplied over the page so the text stays readable */
export const HIGHLIGHT = '#ffe03a'

/**
 * Position on the page as the user sees it: points from the top-left corner (page rotation applied).
 * Text items have no box (width and height 0); their size comes from the font.
 */
interface Box {
  id: string
  /** 0-based page */
  page: number
  x: number
  y: number
  width: number
  height: number
}

export type Item =
  | (Box & { kind: 'text'; text: string; size: number; color: string; font: FontKey })
  | (Box & { kind: 'image'; bytes: Uint8Array; format: 'png' | 'jpeg'; url: string })
  | (Box & { kind: 'whiteout' | 'highlight' })

export interface Watermark {
  enabled: boolean
  text: string
  size: number
  /** 0–1 */
  opacity: number
  /** Degrees, counter-clockwise */
  rotation: number
  color: string
}

export type NumberPosition = `${'top' | 'bottom'}-${'left' | 'center' | 'right'}`

export interface PageNumbers {
  enabled: boolean
  /** `{n}` is the page number, `{total}` the last one */
  format: string
  start: number
  position: NumberPosition
  size: number
}

interface Size {
  width: number
  height: number
}

/** Distance of page numbers from the page edges */
export const NUMBER_MARGIN = mm(10)

/** `"Page {n} of {total}"` for the `index`-th (0-based) of `count` pages, numbered from `start`. */
export const pageLabel = (format: string, index: number, count: number, start: number) =>
  format.replaceAll('{n}', String(index + start)).replaceAll('{total}', String(count + start - 1))

/** Moves a box by (dx, dy) points (dy downwards), keeping it on the page. */
export function moveBox<T extends Box>(b: T, dx: number, dy: number, page: Size): T {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(max, 0))
  return { ...b, x: clamp(b.x + dx, page.width - b.width), y: clamp(b.y + dy, page.height - b.height) }
}

/** Grows a box from its bottom-right corner, at least 4 pt, within the page. `keepRatio` for images. */
export function resizeBox<T extends Box>(b: T, dw: number, dh: number, page: Size, keepRatio: boolean): T {
  const limit = (v: number, max: number) => Math.max(4, Math.min(v, max))
  if (!keepRatio)
    return { ...b, width: limit(b.width + dw, page.width - b.x), height: limit(b.height + dh, page.height - b.y) }
  const ratio = b.height / b.width
  const width = limit(b.width + dw, Math.min(page.width - b.x, (page.height - b.y) / ratio))
  return { ...b, width, height: width * ratio }
}

/**
 * Maps the user's view of a page (points from the top-left, rotation applied, as pdf.js shows it) to the
 * page's own PDF coordinates. `rotate` is what to rotate drawings by so they look upright.
 */
export function pageFrame(crop: { x: number; y: number; width: number; height: number }, rotation: number) {
  const r = ((rotation % 360) + 360) % 360
  const { width: W, height: H } = crop
  const width = r % 180 ? H : W
  const height = r % 180 ? W : H
  const at = (vx: number, top: number) => {
    const vy = height - top // up from the bottom, as PDF counts
    const [x, y] = r === 90 ? [W - vy, vx] : r === 180 ? [W - vx, H - vy] : r === 270 ? [vy, H - vx] : [vx, vy]
    return { x: x + crop.x, y: y + crop.y }
  }
  return { width, height, at, rotate: (deg = 0) => degrees(r + deg) }
}

const hexColor = (hex: string) => {
  const n = Number.parseInt(hex.replace('#', ''), 16) || 0
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** Draws `text` with its baseline-left at (vx, top) of the view, turned `deg` counter-clockwise on screen. */
function drawText(
  page: PDFPage,
  f: ReturnType<typeof pageFrame>,
  text: string,
  vx: number,
  top: number,
  o: { font: PDFFont; size: number; color: string; opacity?: number; deg?: number },
) {
  page.drawText(text, {
    ...f.at(vx, top),
    font: o.font,
    size: o.size,
    color: hexColor(o.color),
    opacity: o.opacity,
    rotate: f.rotate(o.deg),
  })
}

/** Applies the items, watermark and page numbers to the PDF. */
export async function editPdf(
  bytes: Uint8Array,
  items: Item[],
  watermark: Watermark,
  numbers: PageNumbers,
): Promise<Uint8Array> {
  const doc = await openPdf(bytes)
  const fonts = new Map<FontKey, PDFFont>()
  const font = async (key: FontKey) => {
    const f = fonts.get(key) ?? (await doc.embedFont(FONTS[key].pdf))
    fonts.set(key, f)
    return f
  }
  const pages = doc.getPages()

  for (const [i, page] of pages.entries()) {
    const f = pageFrame(page.getCropBox(), page.getRotation().angle)

    for (const it of items.filter((it) => it.page === i)) {
      const corner = f.at(it.x, it.y + it.height) // bottom-left as seen
      if (it.kind === 'text') {
        const lines = it.text.split('\n')
        const fnt = await font(it.font)
        for (const [n, line] of lines.entries())
          drawText(page, f, line, it.x, it.y + it.size * (BASELINE + n * LINE_HEIGHT), { ...it, font: fnt })
      } else if (it.kind === 'image') {
        const img = it.format === 'png' ? await doc.embedPng(it.bytes) : await doc.embedJpg(it.bytes)
        page.drawImage(img, { ...corner, width: it.width, height: it.height, rotate: f.rotate() })
      } else
        page.drawRectangle({
          ...corner,
          width: it.width,
          height: it.height,
          rotate: f.rotate(),
          color: it.kind === 'whiteout' ? rgb(1, 1, 1) : hexColor(HIGHLIGHT),
          blendMode: it.kind === 'highlight' ? BlendMode.Multiply : undefined,
        })
    }

    if (watermark.enabled && watermark.text.trim()) {
      const fnt = await font('helvetica-bold')
      const w = fnt.widthOfTextAtSize(watermark.text, watermark.size)
      // Centre the text: start half its width (and half the cap height) back from the middle, along its angle
      const a = (watermark.rotation * Math.PI) / 180
      const [ox, oy] = [w / 2, watermark.size * 0.35]
      const vx = f.width / 2 - (ox * Math.cos(a) - oy * Math.sin(a))
      const top = f.height / 2 + (ox * Math.sin(a) + oy * Math.cos(a))
      drawText(page, f, watermark.text, vx, top, { ...watermark, font: fnt, deg: watermark.rotation })
    }

    if (numbers.enabled) {
      const fnt = await font('helvetica')
      const text = pageLabel(numbers.format, i, pages.length, numbers.start)
      const w = fnt.widthOfTextAtSize(text, numbers.size)
      const [v, h] = numbers.position.split('-')
      const vx = h === 'left' ? NUMBER_MARGIN : h === 'right' ? f.width - NUMBER_MARGIN - w : (f.width - w) / 2
      const top = v === 'top' ? NUMBER_MARGIN + numbers.size * 0.7 : f.height - NUMBER_MARGIN
      drawText(page, f, text, vx, top, { font: fnt, size: numbers.size, color: '#000000' })
    }
  }
  return doc.save()
}
