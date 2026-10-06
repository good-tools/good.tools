// @vitest-environment node
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { imageName, renderSize, zipFiles } from './pdf-images'

describe('renderSize', () => {
  it('scales points to pixels at the chosen dpi', () => {
    expect(renderSize(612, 792, 72)).toEqual({ scale: 1, width: 612, height: 792, capped: false })
    expect(renderSize(612, 792, 150)).toMatchObject({ width: 1275, height: 1650, capped: false })
    // A4 at 300 dpi
    expect(renderSize(595.28, 841.89, 300)).toMatchObject({ width: 2480, height: 3508 })
  })

  it('caps huge pages to what a canvas can hold, keeping the aspect ratio', () => {
    const banner = renderSize(14400, 720, 600) // 200 × 10 in
    expect(banner.capped).toBe(true)
    expect(banner.width).toBeLessThanOrEqual(16384)
    expect(banner.width / banner.height).toBeCloseTo(20, 1)
    const poster = renderSize(2592, 3456, 600) // 36 × 48 in
    expect(poster.capped).toBe(true)
    expect(poster.width * poster.height).toBeLessThanOrEqual(64_100_000)
  })
})

describe('imageName', () => {
  it('pads the page number to the page count and swaps the extension', () => {
    expect(imageName('report.pdf', 7, 120, 'png')).toBe('report-007.png')
    expect(imageName('Scan.PDF', 1, 9, 'jpg')).toBe('Scan-1.jpg')
    expect(imageName('a.b.pdf', 10, 10, 'webp')).toBe('a.b-10.webp')
  })
})

it('zips files that unzip to the same bytes', () => {
  const a = new Uint8Array([1, 2, 3])
  const b = new TextEncoder().encode('page two')
  expect(
    unzipSync(
      zipFiles([
        ['a-1.jpg', a],
        ['a-2.jpg', b],
      ]),
    ),
  ).toEqual({ 'a-1.jpg': a, 'a-2.jpg': b })
})
