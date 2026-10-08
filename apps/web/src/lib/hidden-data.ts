/**
 * Data an image carries besides its pixels and its tags: embedded previews that may show the uncropped original,
 * bytes after the end of the image (aCropalypse), and tags that identify a person, a device or an edit history.
 */
import { inflateSync, unzlibSync } from 'fflate'
import type { MetaGroup } from '@/lib/metadata'

export interface EmbeddedImage {
  /** ExifTool group and tag, e.g. "IFD1:ThumbnailImage" */
  name: string
  data: Uint8Array
  width?: number
  height?: number
  /** Why it doesn't look like the main image, if it doesn't */
  differs?: string
}

export interface Hidden {
  images: EmbeddedImage[]
  main?: { width: number; height: number }
  /** Bytes after the end of the image */
  trailing?: { offset: number; data: Uint8Array }
  /** PNG tEXt, zTXt and iTXt chunks */
  text: [string, string][]
  recovery?: Recovery
}

/** ExifTool `-json -b -preview:all` output → images. Binary values come back as "base64:…". */
export function parseEmbedded(json: Record<string, unknown>): EmbeddedImage[] {
  const out: EmbeddedImage[] = []
  for (const [name, value] of Object.entries(json))
    if (typeof value === 'string' && value.startsWith('base64:'))
      out.push({ name, data: Uint8Array.from(atob(value.slice(7)), (c) => c.charCodeAt(0)) })
  return out
}

const u32 = (b: Uint8Array, i: number) =>
  (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n))
const isPng = (b: Uint8Array) => u32(b, 0) === 0x89504e47 && u32(b, 4) === 0x0d0a1a0a

function jpegEnd(b: Uint8Array): number | undefined {
  let i = 2
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) return undefined
    const m = b[i + 1] ?? 0
    if (m === 0xd9) return i + 2
    if (m === 0xff || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += m === 0xff ? 1 : 2
      continue
    }
    i += 2 + (((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0))
    // Entropy-coded data runs until the next marker that is not byte stuffing (FF00) or a restart (FFD0-D7)
    if (m === 0xda)
      while (i + 1 < b.length && !(b[i] === 0xff && b[i + 1] !== 0 && ((b[i + 1] ?? 0) & 0xf8) !== 0xd0)) i++
  }
  return undefined
}

/** Chunks of a PNG up to and including IEND */
function* pngChunks(b: Uint8Array) {
  for (let i = 8; i + 12 <= b.length; ) {
    const len = u32(b, i)
    const type = ascii(b, i + 4, 4)
    yield { type, body: b.subarray(i + 8, i + 8 + len), end: i + 12 + len }
    if (type === 'IEND') return
    i += 12 + len
  }
}

/** Offset just past the end of the image, for formats that have one */
export function imageEnd(b: Uint8Array): number | undefined {
  if (b[0] === 0xff && b[1] === 0xd8) return jpegEnd(b)
  if (isPng(b)) for (const c of pngChunks(b)) if (c.type === 'IEND') return c.end
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP')
    return 8 + ((b[4] ?? 0) | ((b[5] ?? 0) << 8) | ((b[6] ?? 0) << 16) | ((b[7] ?? 0) << 24))
  return undefined
}

export function trailingData(b: Uint8Array): Hidden['trailing'] {
  const end = imageEnd(b)
  return end !== undefined && end < b.length ? { offset: end, data: b.slice(end) } : undefined
}

/** A whole JPEG hidden in trailing data, from its SOI marker */
export function trailingJpeg(t: Uint8Array): Uint8Array | undefined {
  for (let i = 0; i + 2 < t.length; i++)
    if (t[i] === 0xff && t[i + 1] === 0xd8 && t[i + 2] === 0xff) {
      const jpg = t.subarray(i)
      return jpg.subarray(0, jpegEnd(jpg) ?? jpg.length)
    }
  return undefined
}

const latin1 = new TextDecoder('latin1')
const utf8 = new TextDecoder()

export function pngText(b: Uint8Array): [string, string][] {
  if (!isPng(b)) return []
  const out: [string, string][] = []
  for (const { type, body } of pngChunks(b)) {
    const nul = body.indexOf(0)
    if (nul < 0) continue
    const key = latin1.decode(body.subarray(0, nul))
    try {
      if (type === 'tEXt') out.push([key, latin1.decode(body.subarray(nul + 1))])
      else if (type === 'zTXt') out.push([key, latin1.decode(unzlibSync(body.subarray(nul + 2)))])
      else if (type === 'iTXt') {
        const compressed = body[nul + 1] === 1
        let i = body.indexOf(0, nul + 3) + 1 // language tag
        i = body.indexOf(0, i) + 1 // translated keyword
        const text = body.subarray(i)
        out.push([key, utf8.decode(compressed ? unzlibSync(text) : text)])
      }
    } catch {
      // a corrupt chunk is not worth failing the whole file over
    }
  }
  return out
}

// ---- Thumbnail vs image comparison --------------------------------------------------------------------------------

/** 64-bit difference hash of a 9×8 greyscale image: is each pixel brighter than its right neighbour? */
export function dhash(gray: ArrayLike<number>): boolean[] {
  const bits: boolean[] = []
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits.push((gray[y * 9 + x] ?? 0) > (gray[y * 9 + x + 1] ?? 0))
  return bits
}

export interface Fingerprint {
  width: number
  height: number
  hash: boolean[]
}

/** Reason the thumbnail doesn't match the image, or undefined when it does */
export function compareImages(main: Fingerprint, thumb: Fingerprint): string | undefined {
  const a = main.width / main.height
  const b = thumb.width / thumb.height
  if (Math.abs(a - b) / a > 0.03)
    return `Aspect ratio differs (${thumb.width}×${thumb.height} vs ${main.width}×${main.height})`
  // ponytail: a 64-bit dHash only catches big changes; a small edit inside the frame gets through
  const distance = main.hash.filter((bit, i) => bit !== thumb.hash[i]).length
  return distance > 12 ? `Content differs (${distance}/64 hash bits)` : undefined
}

/** Decodes with the browser (worker-safe). Undefined for formats it can't decode, e.g. HEIC outside Safari. */
export async function fingerprint(data: Uint8Array): Promise<Fingerprint | undefined> {
  try {
    // Thumbnails carry no orientation of their own, so compare the main image unrotated too
    const bmp = await createImageBitmap(new Blob([data as BlobPart]), { imageOrientation: 'none' })
    const small = await createImageBitmap(bmp, { resizeWidth: 9, resizeHeight: 8, resizeQuality: 'high' })
    const ctx = new OffscreenCanvas(9, 8).getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(small, 0, 0)
    const px = ctx.getImageData(0, 0, 9, 8).data
    const gray = Array.from(
      { length: 72 },
      (_, i) => 0.299 * (px[i * 4] ?? 0) + 0.587 * (px[i * 4 + 1] ?? 0) + 0.114 * (px[i * 4 + 2] ?? 0),
    )
    return { width: bmp.width, height: bmp.height, hash: dhash(gray) }
  } catch {
    return undefined
  }
}

/** Fills in sizes and flags embedded images that don't look like the main image (browser only). */
export async function compareEmbedded(hidden: Hidden, file: Uint8Array) {
  const main = await fingerprint(file)
  if (main) hidden.main = { width: main.width, height: main.height }
  for (const img of hidden.images) {
    const fp = await fingerprint(img.data)
    if (!fp) continue
    img.width = fp.width
    img.height = fp.height
    if (main) img.differs = compareImages(main, fp)
  }
}

// ---- aCropalypse recovery -----------------------------------------------------------------------------------------

/** Tail of the original image's zlib stream, decompressed from a deflate block boundary onwards */
export interface Recovery {
  data: Uint8Array
  /** 1 where the byte was decoded, 0 where it was copied from the lost part of the stream */
  known: Uint8Array
  /** Bytes per pixel the cropped image uses (8-bit RGB or RGBA assumed for the original) */
  bpp: number
  /** Best guess for the original width */
  width: number
}

/** IDAT payload left in a PNG trailer: it starts mid-chunk of the original file and ends with its IEND. */
function leftoverIdat(t: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = []
  let first = -1
  for (let p = 8; p + 4 <= t.length; p++)
    if (t[p] === 0x49 && ascii(t, p, 4) === 'IDAT' && p + 8 + u32(t, p - 4) <= t.length) {
      first = p - 4
      break
    }
  if (first < 0) return t.subarray(0, Math.max(0, t.length - 16)) // one chunk: its tail, CRC, then IEND
  parts.push(t.subarray(0, first - 4)) // minus the CRC of the chunk it was cut from
  for (let i = first; i + 12 <= t.length; ) {
    const len = u32(t, i)
    if (ascii(t, i + 4, 4) !== 'IDAT') break
    parts.push(t.subarray(i + 8, i + 8 + len))
    i += 12 + len
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

const DICT_A = new Uint8Array(32768)
const DICT_B = new Uint8Array(32768).fill(0xff)
const SEARCH_BYTES = 1 << 18

/**
 * Finds a non-final dynamic-Huffman deflate block that decodes to the end of the stream when the lost 32 KB window
 * is replaced by filler, as the public acropalypse tools do. Decoding twice with different filler shows which output
 * bytes came from the lost window.
 */
export function recoverPng(file: Uint8Array): Recovery | undefined {
  if (!isPng(file)) return undefined
  const trailing = trailingData(file)
  if (!trailing || trailing.data.length < 64) return undefined
  const idat = leftoverIdat(trailing.data)
  const ihdr = pngChunks(file).next().value
  const colorType = ihdr?.type === 'IHDR' ? ihdr.body[9] : 6
  const bpp = colorType === 2 ? 3 : 4
  // Deflate blocks start at any bit: keep 8 shifted copies so each candidate is a zero-copy view
  const shifted = Array.from({ length: 8 }, (_, s) =>
    s ? idat.map((v, j) => (v >> s) | ((idat[j + 1] ?? 0) << (8 - s))) : idat,
  )
  const limit = Math.min(idat.length - 16, SEARCH_BYTES)
  for (let j = 0; j < limit; j++)
    for (let s = 0; s < 8; s++) {
      const view = (shifted[s] as Uint8Array).subarray(j)
      if (!plausibleBlock(view)) continue
      let data: Uint8Array
      try {
        data = inflateSync(view, { dictionary: DICT_A })
      } catch {
        continue
      }
      const other = inflateSync(view, { dictionary: DICT_B })
      const rec: Recovery = { data, known: data.map((v, i) => (v === other[i] ? 1 : 0)), bpp, width: 0 }
      // A rare garbage block that decodes still won't line up into rows at any width
      rec.width = guessWidth(rec) ?? 0
      if (rec.width) return rec
    }
  return undefined
}

/** Sum of 2^-len over the used codes, scaled by 2^15: a complete prefix code sums to exactly 2^15 */
const kraft = (lens: number[]) => lens.reduce((n, l) => n + (l ? 1 << (15 - l) : 0), 0)
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

/**
 * Whether `b` starts with a non-final dynamic-Huffman block header whose three codes are valid, as zlib requires.
 * fflate doesn't check this, and inflating garbage from every bit offset would take minutes.
 */
export function plausibleBlock(b: Uint8Array): boolean {
  if (((b[0] ?? 0) & 7) !== 0b100) return false // BFINAL=0, BTYPE=2, read LSB first
  let pos = 3
  const bits = (n: number) => {
    let v = 0
    for (let k = 0; k < n; k++, pos++) v |= (((b[pos >> 3] ?? 0) >> (pos & 7)) & 1) << k
    return v
  }
  const hlit = bits(5) + 257
  const hdist = bits(5) + 1
  const hclen = bits(4) + 4
  if (hlit > 286 || hdist > 30) return false
  const cl = new Array<number>(19).fill(0)
  for (let i = 0; i < hclen; i++) cl[CL_ORDER[i] ?? 0] = bits(3)
  if (kraft(cl) !== 1 << 15) return false
  // Canonical decoding, as in zlib's puff.c
  const count = new Array<number>(8).fill(0)
  for (const l of cl) count[l] = (count[l] ?? 0) + 1
  const symbols = cl
    .map((l, sym) => [l, sym] as const)
    .filter(([l]) => l)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1])
  const decode = () => {
    let code = 0
    let first = 0
    let index = 0
    for (let len = 1; len < 8; len++) {
      code |= bits(1)
      const n = count[len] ?? 0
      if (code - n < first) return symbols[index + code - first]?.[1] ?? -1
      index += n
      first = (first + n) << 1
      code <<= 1
    }
    return -1
  }
  const lens: number[] = []
  while (lens.length < hlit + hdist) {
    const sym = decode()
    if (sym < 0) return false
    if (sym < 16) lens.push(sym)
    else {
      const prev = lens.at(-1)
      if (sym === 16 && prev === undefined) return false
      const [value, times] = sym === 16 ? [prev ?? 0, 3 + bits(2)] : sym === 17 ? [0, 3 + bits(3)] : [0, 11 + bits(7)]
      for (let k = 0; k < times; k++) lens.push(value)
    }
  }
  if (lens.length !== hlit + hdist) return false
  const lit = lens.slice(0, hlit)
  const dist = lens.slice(hlit)
  // An incomplete code is only allowed when it is a single one-bit code
  const ok = (l: number[]) => kraft(l) === 1 << 15 || Math.max(...l) <= 1
  return (lit[256] ?? 0) > 0 && ok(lit) && ok(dist)
}

/** Screen widths, most common first: screenshots are what gets cropped */
const SCREEN_WIDTHS = [
  1080, 1170, 1179, 1284, 1290, 1440, 1920, 2560, 1366, 1536, 1280, 1242, 1125, 828, 750, 720, 3840, 2880, 2048, 1600,
  1680, 1200, 1024, 800,
]

/** Rows end where the stream ends, so each candidate width puts a filter-type byte (0-4) at known positions. */
export function widthFits(rec: Recovery, width: number, bpp = rec.bpp): boolean {
  const row = 1 + width * bpp
  let checked = 0
  for (let p = rec.data.length - row; p >= 0; p -= row) {
    if (!rec.known[p]) continue
    if ((rec.data[p] ?? 0) > 4) return false
    checked++
  }
  return checked >= 16
}

function guessWidth(rec: Recovery): number | undefined {
  const screen = SCREEN_WIDTHS.find((w) => widthFits(rec, w))
  if (screen) return screen
  for (let w = 1; w <= 8192; w++) if (widthFits(rec, w)) return w
  return undefined
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/**
 * Unfilters the recovered rows at `width`. A pixel is lost (drawn grey) when any byte it was rebuilt from is lost,
 * including the unknown row above the first recovered one.
 */
export function renderRecovered(rec: Recovery, width: number) {
  const bpp = rec.bpp
  const rowLen = 1 + width * bpp
  const height = Math.floor(rec.data.length / rowLen)
  const start = rec.data.length - height * rowLen
  const stride = width * bpp
  const val = new Uint8Array(stride * height)
  const ok = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const p = start + y * rowLen
    const filter = rec.data[p] ?? 0
    const rowOk = rec.known[p] === 1 && filter <= 4
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x
      const hasLeft = x >= bpp
      const a = hasLeft ? (val[i - bpp] ?? 0) : 0
      const b = y ? (val[i - stride] ?? 0) : 0
      const c = y && hasLeft ? (val[i - stride - bpp] ?? 0) : 0
      const aOk = !hasLeft || ok[i - bpp] === 1
      const bOk = y > 0 && ok[i - stride] === 1
      const cOk = !hasLeft || (y > 0 && ok[i - stride - bpp] === 1)
      const [pred, predOk] =
        filter === 0
          ? [0, true]
          : filter === 1
            ? [a, aOk]
            : filter === 2
              ? [b, bOk]
              : filter === 3
                ? [(a + b) >> 1, aOk && bOk]
                : [paeth(a, b, c), aOk && bOk && cOk]
      val[i] = ((rec.data[p + 1 + x] ?? 0) + pred) & 255
      ok[i] = rowOk && predOk && rec.known[p + 1 + x] === 1 ? 1 : 0
    }
  }
  const rgba = new Uint8ClampedArray(width * height * 4)
  let lost = 0
  for (let px = 0; px < width * height; px++) {
    let good = true
    for (let k = 0; k < bpp; k++) good &&= ok[px * bpp + k] === 1
    if (!good) lost++
    for (let k = 0; k < 3; k++) rgba[px * 4 + k] = good ? (val[px * bpp + k] ?? 0) : 128
    rgba[px * 4 + 3] = good && bpp === 4 ? (val[px * bpp + 3] ?? 255) : 255
  }
  return { width, height, rgba, lost: height ? lost / (width * height) : 1 }
}

// ---- Revealing tags -----------------------------------------------------------------------------------------------

const REVEALING: [string, RegExp][] = [
  ['Edit history', /^(History\w*|DocumentAncestors|DerivedFrom\w*|Ingredients\w*|Pantry\w*)$/],
  ['Original file', /^(PreservedFileName|OriginalFileName|RawFileName|DocumentName|SourceFile\w+)$/],
  ['Software', /^(Software|CreatorTool|ProcessingSoftware|Producer|HostComputer)$/],
  ['Serial number', /SerialNumber$/],
  ['Person', /^(OwnerName|CameraOwnerName|Artist|Author|By-line|Creator|XPAuthor|LastModifiedBy|Copyright)$/],
  ['Unique ID', /^(DocumentID|InstanceID|OriginalDocumentID|ImageUniqueID|ContentIdentifier)$/],
  ['Comment', /^(Comment|UserComment|XPComment|ImageDescription|Description)$/],
  ['Colour profile', /^ProfileDescription$/],
  ['Embedded file', /Embedded|Attachment/],
]

/** Tags worth pointing out: [category, tag, value] */
export function revealingTags(groups: MetaGroup[]): [string, string, string][] {
  const out: [string, string, string][] = []
  for (const g of groups) {
    for (const [, tag, value] of g.tags) {
      // The File group describes the file we were given, except for the JPEG comment (COM) ExifTool files there
      if (g.name === 'File' && tag !== 'Comment') continue
      const hit = REVEALING.find(([, re]) => re.test(tag))
      if (hit && value.trim()) out.push([hit[0], tag, value])
    }
  }
  return out.sort((a, b) => REVEALING.findIndex(([c]) => c === a[0]) - REVEALING.findIndex(([c]) => c === b[0]))
}

/** ExifTool's `48 deg 51' 30.24" N, 2 deg 17' 40.20" E` → OpenStreetMap link */
export function mapLink(location: string): string | undefined {
  const parts = [...location.matchAll(/([\d.]+) deg (?:([\d.]+)' )?(?:([\d.]+)" )?([NSEW])/g)].map(
    ([, d, m = '0', s = '0', ref]) =>
      (Number(d) + Number(m) / 60 + Number(s) / 3600) * (ref === 'S' || ref === 'W' ? -1 : 1),
  )
  const [lat, lon] = parts
  if (lat === undefined || lon === undefined) return undefined
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=16/${lat.toFixed(6)}/${lon.toFixed(6)}`
}
