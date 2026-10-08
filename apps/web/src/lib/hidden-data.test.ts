// @vitest-environment node
// (ExifTool's wasm loads from disk under Node; in jsdom it would try to fetch it)
import { beforeAll, describe, expect, it } from 'vitest'
import Vips from 'wasm-vips'
import {
  compareImages,
  dhash,
  type Fingerprint,
  mapLink,
  pngText,
  recoverPng,
  renderRecovered,
  revealingTags,
  trailingData,
  trailingJpeg,
  widthFits,
} from './hidden-data'
import { readMetadata, stripMetadata } from './metadata'

let vips: Awaited<ReturnType<typeof Vips>>
beforeAll(async () => {
  vips = await Vips()
})

const solid = (w: number, h: number, rgb: number[]) =>
  vips.Image.black(w, h).add(rgb).cast('uchar').copy({ interpretation: 'srgb' })

/** Deterministic test pattern with some noise, so it doesn't compress to nothing */
function pattern(w: number, h: number) {
  const px = new Uint8Array(w * h * 3)
  let seed = 1
  for (let i = 0; i < w * h; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const x = i % w
    const y = Math.floor(i / w)
    px[i * 3] = ((x + y) & 255) ^ (seed & 15)
    px[i * 3 + 1] = ((x >> 4) ^ (y >> 4)) * 16 + ((seed >> 8) & 15)
    px[i * 3 + 2] = (y < h / 2 ? 40 : 200) + ((seed >> 16) & 7)
  }
  return { px, img: vips.Image.newFromMemory(px, w, h, 3, vips.BandFormat.uchar).copy({ interpretation: 'srgb' }) }
}

const be = (n: number, len: number) => Array.from({ length: len }, (_, i) => (n >>> (8 * (len - 1 - i))) & 255)

/** JPEG with an EXIF APP1 whose IFD1 holds `thumb` as its thumbnail */
function withThumbnail(main: Uint8Array, thumb: Uint8Array) {
  const ifd0 = [...be(1, 2), ...be(0x010f, 2), ...be(2, 2), ...be(4, 4), ...[0x41, 0x63, 0x6d, 0], ...be(26, 4)]
  const ifd1 = [...be(2, 2), ...be(0x0201, 2), ...be(4, 2), ...be(1, 4), ...be(56, 4)]
  ifd1.push(...be(0x0202, 2), ...be(4, 2), ...be(1, 4), ...be(thumb.length, 4), ...be(0, 4))
  const tiff = [0x4d, 0x4d, 0, 42, ...be(8, 4), ...ifd0, ...ifd1, ...thumb]
  const body = [...new TextEncoder().encode('Exif\0\0'), ...tiff]
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, ...be(body.length + 2, 2), ...body, ...main.subarray(2)])
}

const concat = (...parts: ArrayLike<number>[]) => new Uint8Array(parts.flatMap((p) => Array.from(p)))

/** What the browser path computes, done with libvips */
function fingerprint(data: Uint8Array): Fingerprint {
  const img = vips.Image.newFromBuffer(data)
  const gray = vips.Image.thumbnailBuffer(data, 9, { height: 8, size: 'force' }).colourspace('b-w').extractBand(0)
  return { width: img.width, height: img.height, hash: dhash(gray.writeToMemory()) }
}

describe('embedded thumbnails', () => {
  it('extracts an EXIF thumbnail and flags one that does not match the image', async () => {
    const main = pattern(320, 240).img.writeToBuffer('.jpg')
    const edited = solid(160, 160, [0, 50, 250]).writeToBuffer('.jpg') // square and a different picture
    const jpg = withThumbnail(main, edited)

    const hidden = (await readMetadata('a.jpg', jpg)).hidden
    expect(hidden?.images.map((i) => i.name)).toEqual(['IFD1:ThumbnailImage'])
    const thumb = hidden?.images[0]?.data ?? new Uint8Array()
    expect(thumb).toEqual(edited)
    expect(compareImages(fingerprint(main), fingerprint(thumb))).toMatch(/Aspect ratio differs \(160×160 vs 320×240\)/)

    // Same frame, different content
    const other = solid(160, 120, [0, 50, 250]).insert(solid(40, 120, [255, 255, 255]), 0, 0)
    expect(compareImages(fingerprint(main), fingerprint(other.writeToBuffer('.jpg')))).toMatch(/Content differs/)
    // An honest thumbnail matches
    const honest = vips.Image.thumbnailBuffer(main, 160).writeToBuffer('.jpg')
    expect(compareImages(fingerprint(main), fingerprint(honest))).toBeUndefined()
  }, 30_000)
})

describe('trailing data', () => {
  it('finds bytes after JPEG EOI, PNG IEND and the WebP RIFF size, and a JPEG hidden there', () => {
    const jpg = solid(16, 16, [1, 2, 3]).writeToBuffer('.jpg')
    const hiddenJpg = solid(8, 8, [9, 9, 9]).writeToBuffer('.jpg')
    const t = trailingData(concat(jpg, [1, 2, 3], hiddenJpg, [7, 7]))
    expect(t?.offset).toBe(jpg.length)
    expect(t?.data.length).toBe(3 + hiddenJpg.length + 2)
    expect(trailingJpeg(t?.data ?? new Uint8Array())).toEqual(hiddenJpg)

    const png = solid(16, 16, [1, 2, 3]).writeToBuffer('.png')
    expect(trailingData(concat(png, [0xde, 0xad]))).toEqual({ offset: png.length, data: new Uint8Array([0xde, 0xad]) })
    const webp = solid(16, 16, [1, 2, 3]).writeToBuffer('.webp')
    expect(trailingData(concat(webp, [5]))?.offset).toBe(webp.length)

    expect(trailingData(jpg)).toBeUndefined()
    expect(trailingData(png)).toBeUndefined()
  })
})

describe('aCropalypse recovery', () => {
  it('recovers the bottom of the original from a PNG cropped by overwriting without truncating', () => {
    const W = 640
    const H = 480
    const { px, img } = pattern(W, H)
    const original = img.writeToBuffer('.png', { compression: 9 })
    const cropped = img.crop(0, 0, 120, 80).writeToBuffer('.png')
    expect(cropped.length).toBeLessThan(original.length / 2)
    const file = original.slice()
    file.set(cropped) // the vulnerable editors wrote the new file over the old one and kept its length

    const rec = recoverPng(file)
    expect(rec).toBeDefined()
    if (!rec) return
    expect(rec.width).toBe(W)
    expect(widthFits(rec, W + 1)).toBe(false)

    const out = renderRecovered(rec, W)
    expect(out.height).toBeGreaterThan(H / 3)
    expect(out.lost).toBeLessThan(0.5)
    // Every pixel shown as recovered is the original pixel; the rest are grey
    const top = H - out.height
    let checked = 0
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4
        const s = ((top + y) * W + x) * 3
        if (out.rgba[o] === 128 && out.rgba[o + 1] === 128 && out.rgba[o + 2] === 128) continue
        expect([out.rgba[o], out.rgba[o + 1], out.rgba[o + 2]]).toEqual([px[s], px[s + 1], px[s + 2]])
        checked++
      }
    expect(checked).toBeGreaterThan(W * 50)
  }, 60_000)

  it('leaves normal PNGs alone', () => {
    expect(recoverPng(pattern(64, 64).img.writeToBuffer('.png'))).toBeUndefined()
  })
})

describe('stripping', () => {
  it('removes the thumbnail and the trailing data, as the re-read confirms', async () => {
    const main = pattern(320, 240).img.writeToBuffer('.jpg')
    const jpg = concat(withThumbnail(main, solid(160, 160, [0, 50, 250]).writeToBuffer('.jpg')), [1, 2, 3, 4])
    const before = await readMetadata('a.jpg', jpg)
    expect(before.hidden?.images).toHaveLength(1)
    expect(before.hidden?.trailing?.data.length).toBe(4)
    const after = await readMetadata('a.jpg', await stripMetadata('a.jpg', jpg))
    expect(after.hidden?.images).toEqual([])
    expect(after.hidden?.trailing).toBeUndefined()

    const png = concat(pattern(64, 64).img.writeToBuffer('.png'), [9, 9, 9])
    const cleanPng = await stripMetadata('a.png', png)
    expect((await readMetadata('a.png', cleanPng)).hidden?.trailing).toBeUndefined()
  }, 30_000)
})

it('reads PNG text chunks', () => {
  const png = solid(8, 8, [0, 0, 0]).writeToBuffer('.png')
  const text = (type: string, body: number[]) => [
    ...be(body.length, 4),
    ...new TextEncoder().encode(type),
    ...body,
    0,
    0,
    0,
    0,
  ]
  const enc = (s: string) => Array.from(new TextEncoder().encode(s))
  const withText = concat(
    png.subarray(0, 33), // signature + IHDR
    text('tEXt', [...enc('Author'), 0, ...enc('Jane')]),
    text('iTXt', [...enc('Comment'), 0, 0, 0, ...enc('en'), 0, 0, ...enc('héllo')]),
    png.subarray(33),
  )
  expect(pngText(withText)).toEqual([
    ['Author', 'Jane'],
    ['Comment', 'héllo'],
  ])
})

it('picks out revealing tags and links GPS to a map', () => {
  const tags = revealingTags([
    {
      name: 'File',
      tags: [
        ['', 'FileName', 'a.jpg'],
        ['', 'Comment', 'shot for X'],
      ],
    },
    {
      name: 'EXIF',
      tags: [
        ['IFD0', 'Make', 'Canon'],
        ['ExifIFD', 'BodySerialNumber', '123'],
        ['IFD0', 'Software', 'GIMP'],
      ],
    },
    { name: 'XMP', tags: [['XMP-xmpMM', 'HistoryAction', 'saved, cropped']] },
  ])
  expect(tags).toEqual([
    ['Edit history', 'HistoryAction', 'saved, cropped'],
    ['Software', 'Software', 'GIMP'],
    ['Serial number', 'BodySerialNumber', '123'],
    ['Comment', 'Comment', 'shot for X'],
  ])
  expect(mapLink(`48 deg 51' 30.24" N, 2 deg 17' 40.20" W`)).toBe(
    'https://www.openstreetmap.org/?mlat=48.858400&mlon=-2.294500#map=16/48.858400/-2.294500',
  )
})
