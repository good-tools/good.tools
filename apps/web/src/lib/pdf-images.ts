import { zipSync } from 'fflate'

export const IMAGE_FORMATS = {
  jpg: { label: 'JPG', mime: 'image/jpeg', lossy: true },
  png: { label: 'PNG', mime: 'image/png', lossy: false },
  webp: { label: 'WebP', mime: 'image/webp', lossy: true },
} as const

export type ImageFormat = keyof typeof IMAGE_FORMATS

// ponytail: fixed caps that fit Chrome/Firefox canvases (A4 at 600 dpi is ~35 MP); Safari stops at ~16.7 MP
const MAX_SIDE = 16384
const MAX_PIXELS = 64_000_000

/**
 * pdf.js scale and pixel size for a page of `width`×`height` points at `dpi`,
 * shrunk to stay inside what a browser canvas can hold.
 */
export function renderSize(width: number, height: number, dpi: number) {
  let scale = dpi / 72
  scale = Math.min(scale, MAX_SIDE / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)))
  return { scale, width: Math.round(width * scale), height: Math.round(height * scale), capped: scale < dpi / 72 }
}

/** `report.pdf`, page 7 of 120, png → `report-007.png` (zero-padded so files sort in page order). */
export function imageName(pdfName: string, page: number, count: number, format: ImageFormat) {
  return `${pdfName.replace(/\.pdf$/i, '')}-${String(page).padStart(String(count).length, '0')}.${format}`
}

/** A zip of the files, stored without recompression (the images are compressed already). */
export function zipFiles(files: [name: string, bytes: Uint8Array][]): Uint8Array {
  return zipSync(Object.fromEntries(files), { level: 0 })
}
