import { PDFDocument } from '@cantoo/pdf-lib'

/** Millimetres to PDF points (1/72 in). */
export const mm = (v: number) => (v * 72) / 25.4

/** Portrait sizes in points. */
export const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a5: [419.53, 595.28],
} as const

export type PageSize = keyof typeof PAGE_SIZES | 'fit'

/** ISO/IEC 7810 ID-1: bank cards, most national ID cards (e.g. CNIC). */
const CARD: [number, number] = [mm(85.6), mm(53.98)]

export interface LayoutOptions {
  pageSize: PageSize
  landscape: boolean
  /** Images per page: 1, 2, 4 or 6 (ignored when pageSize is 'fit') */
  perPage: number
  /** Points, around the page edge and between images */
  margin: number
  /** 'fit' fills the cell, 'card' prints at real ID-card size */
  size: 'fit' | 'card'
}

export interface Placed {
  index: number
  /** PDF coordinates: origin bottom-left, points */
  x: number
  y: number
  width: number
  height: number
}

export interface PageLayout {
  width: number
  height: number
  items: Placed[]
}

interface Dims {
  width: number
  height: number
}

/** Columns × rows for a portrait page; swapped in landscape. */
function grid(perPage: number, landscape: boolean): [number, number] {
  const g: [number, number] = perPage === 2 ? [1, 2] : perPage === 4 ? [2, 2] : perPage === 6 ? [2, 3] : [1, 1]
  return landscape ? [g[1], g[0]] : g
}

/** Largest size with the image's aspect ratio inside `box`. */
function contain(img: Dims, box: Dims): Dims {
  const s = Math.min(box.width / img.width, box.height / img.height)
  return { width: img.width * s, height: img.height * s }
}

/** Card box turned to match the image's orientation. */
const cardFor = (img: Dims): Dims =>
  img.width >= img.height ? { width: CARD[0], height: CARD[1] } : { width: CARD[1], height: CARD[0] }

/** Where each image goes: pages in order, images centred in grid cells. Pure, so the preview and the PDF agree. */
export function layoutPages(images: Dims[], o: LayoutOptions): PageLayout[] {
  if (o.pageSize === 'fit')
    // Pixels at 96 dpi
    return images.map((img, index) => {
      const box =
        o.size === 'card' ? contain(img, cardFor(img)) : { width: img.width * 0.75, height: img.height * 0.75 }
      return {
        width: box.width + 2 * o.margin,
        height: box.height + 2 * o.margin,
        items: [{ index, x: o.margin, y: o.margin, ...box }],
      }
    })

  const [w, h] = PAGE_SIZES[o.pageSize]
  const [pw, ph] = o.landscape ? [h, w] : [w, h]
  const [cols, rows] = grid(o.perPage, o.landscape)
  const perPage = cols * rows
  const cell = {
    width: (pw - 2 * o.margin - (cols - 1) * o.margin) / cols,
    height: (ph - 2 * o.margin - (rows - 1) * o.margin) / rows,
  }

  const pages: PageLayout[] = []
  images.forEach((img, index) => {
    const slot = index % perPage
    if (slot === 0) pages.push({ width: pw, height: ph, items: [] })
    // A card only ever shrinks to fit its cell
    const card = cardFor(img)
    const target = o.size === 'card' && card.width <= cell.width && card.height <= cell.height ? card : cell
    const box = contain(img, target)
    const left = o.margin + (slot % cols) * (cell.width + o.margin) + (cell.width - box.width) / 2
    const top = o.margin + Math.floor(slot / cols) * (cell.height + o.margin) + (cell.height - box.height) / 2
    pages.at(-1)?.items.push({ index, x: left, y: ph - top - box.height, ...box })
  })
  return pages
}

export interface PdfImage extends Dims {
  bytes: Uint8Array
  format: 'png' | 'jpeg'
}

export async function imagesToPdf(images: PdfImage[], o: LayoutOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const embedded = await Promise.all(
    images.map((i) => (i.format === 'png' ? doc.embedPng(i.bytes) : doc.embedJpg(i.bytes))),
  )
  for (const page of layoutPages(images, o)) {
    const p = doc.addPage([page.width, page.height])
    for (const { index, ...rect } of page.items) p.drawImage(embedded[index]!, rect)
  }
  return doc.save()
}

/**
 * Opens a PDF. Files with only an owner password (restrictions, no open password) open without one.
 * Throws a `PasswordError` when an open password is needed or wrong.
 */
export async function openPdf(bytes: Uint8Array, password = ''): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { password })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'NEEDS PASSWORD') throw new PasswordError('This PDF needs a password')
    if (msg === 'Password incorrect') throw new PasswordError('Wrong password')
    throw e
  }
}

export class PasswordError extends Error {
  override name = 'PasswordError'
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const bytes of files) {
    const src = await openPdf(bytes)
    for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page)
  }
  return out.save()
}

/** `report.pdf` → `report-suffix.pdf` */
export const renamePdf = (name: string, suffix: string) => `${name.replace(/\.pdf$/i, '')}-${suffix}.pdf`
