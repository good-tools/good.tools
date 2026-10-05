/** PDF compression off the main thread: recompress images with wasm-vips, then squeeze the structure with qpdf. */
import {
  decodePDFRawStream,
  PDFArray,
  type PDFContext,
  PDFDict,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFRawStream,
  PDFRef,
} from '@cantoo/pdf-lib'
import type Vips from 'wasm-vips'
import vipsUrl from 'wasm-vips/vips.wasm?url'
import { type ImageInfo, PRESETS, type Preset, planImage, shouldReplace } from '@/lib/compress-pdf'
import { openPdf, PasswordError } from '@/lib/pdf'
import { optimizePdf } from '@/lib/qpdf'

export interface CompressRequest {
  id: number
  bytes: Uint8Array
  preset: Preset
}

export type CompressResponse =
  | { type: 'status'; id: number; status: string }
  | { type: 'done'; id: number; bytes: Uint8Array; images: number; recompressed: number }
  | { type: 'error'; id: number; error: string }

let vipsPromise: Promise<typeof Vips> | null = null
const loadVips = () =>
  (vipsPromise ??= import('wasm-vips').then((v) =>
    v.default({
      dynamicLibraries: [],
      locateFile: (file: string, prefix: string) => (file === 'vips.wasm' ? vipsUrl : prefix + file),
    }),
  ))

const name = (o: PDFObject | undefined) => (o instanceof PDFName ? o.decodeText() : '')
const num = (o: PDFObject | undefined) => (o instanceof PDFNumber ? o.asNumber() : 0)

/** Colour components of an image colour space; 0 for indexed/separation/unknown. */
function components(ctx: PDFContext, cs: PDFObject | undefined): number {
  const resolved = cs instanceof PDFRef ? ctx.lookup(cs) : cs
  const n = name(resolved)
  if (n === 'DeviceGray' || n === 'CalGray') return 1
  if (n === 'DeviceRGB' || n === 'CalRGB') return 3
  if (n === 'DeviceCMYK') return 4
  if (resolved instanceof PDFArray) {
    const family = name(resolved.get(0))
    if (family === 'ICCBased') {
      const icc = ctx.lookup(resolved.get(1))
      return icc instanceof PDFRawStream ? num(icc.dict.lookup(PDFName.of('N'))) : 0
    }
    if (family === 'CalGray') return 1
    if (family === 'CalRGB') return 3
  }
  return 0
}

function imageInfo(ctx: PDFContext, d: PDFDict): ImageInfo {
  const filter = d.lookup(PDFName.of('Filter'))
  const parms = d.lookup(PDFName.of('DecodeParms'))
  return {
    width: num(d.lookup(PDFName.of('Width'))),
    height: num(d.lookup(PDFName.of('Height'))),
    bitsPerComponent: num(d.lookup(PDFName.of('BitsPerComponent'))),
    components: components(ctx, d.get(PDFName.of('ColorSpace'))),
    filter: filter instanceof PDFArray ? (filter.size() === 1 ? name(filter.lookup(0)) : 'multiple') : name(filter),
    predictor: parms instanceof PDFDict && num(parms.lookup(PDFName.of('Predictor'))) > 1,
    special: [PDFName.of('ImageMask'), PDFName.of('Mask'), PDFName.of('Decode')].some((k) => d.has(k)),
  }
}

/** Recompresses one image stream in place; returns true when it was replaced. */
function recompress(vips: typeof Vips, ctx: PDFContext, ref: PDFRef, stream: PDFRawStream, preset: Preset) {
  const info = imageInfo(ctx, stream.dict)
  const target = planImage(info, preset)
  if (!target) return false
  const images: Vips.Image[] = []
  try {
    let img: Vips.Image
    if (info.filter === 'DCTDecode') img = vips.Image.newFromBuffer(stream.contents)
    else {
      const pixels = decodePDFRawStream(stream).decode()
      if (pixels.length < info.width * info.height * info.components) return false
      img = vips.Image.newFromMemory(pixels, info.width, info.height, info.components, vips.BandFormat.uchar)
    }
    images.push(img)
    // A JPEG whose pixels disagree with the dictionary (CMYK, odd sizes) is left alone
    if (img.width !== info.width || img.height !== info.height || img.bands !== info.components) return false
    if (target.width !== img.width || target.height !== img.height) {
      img = img.resize(target.width / img.width, { vscale: target.height / img.height })
      images.push(img)
    }
    const jpeg = img.jpegsaveBuffer({ Q: PRESETS[preset].quality, keep: 'none' })
    if (!shouldReplace(stream.contents.length, jpeg.length)) return false
    const dict = stream.dict.clone(ctx)
    dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
    dict.delete(PDFName.of('DecodeParms'))
    dict.set(PDFName.of('Width'), PDFNumber.of(target.width))
    dict.set(PDFName.of('Height'), PDFNumber.of(target.height))
    ctx.assign(ref, PDFRawStream.of(dict, jpeg))
    return true
  } catch {
    return false // undecodable image: keep the original
  } finally {
    for (const i of images) i.delete()
  }
}

async function compress(bytes: Uint8Array, preset: Preset, status: (s: string) => void) {
  status('Reading PDF...')
  const doc = await openPdf(bytes)
  const ctx = doc.context
  const streams = ctx
    .enumerateIndirectObjects()
    .filter(
      (e): e is [PDFRef, PDFRawStream] =>
        e[1] instanceof PDFRawStream && e[1].dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image'),
    )
  let recompressed = 0
  if (streams.length) {
    status('Loading image codec...')
    const vips = await loadVips()
    for (const [i, [ref, stream]] of streams.entries()) {
      status(`Recompressing image ${i + 1} of ${streams.length}...`)
      if (recompress(vips, ctx, ref, stream, preset)) recompressed++
    }
  }
  status('Optimising structure...')
  // Untouched files go straight to qpdf, so pdf-lib never re-serialises them
  const input = recompressed ? await doc.save({ useObjectStreams: false }) : bytes
  return { bytes: await optimizePdf(input), images: streams.length, recompressed }
}

self.onmessage = async ({ data: msg }: MessageEvent<CompressRequest>) => {
  const reply = (r: CompressResponse, transfer: Transferable[] = []) => self.postMessage(r, { transfer })
  try {
    const out = await compress(msg.bytes, msg.preset, (status) => reply({ type: 'status', id: msg.id, status }))
    reply({ type: 'done', id: msg.id, ...out }, [out.bytes.buffer])
  } catch (e) {
    const error =
      e instanceof PasswordError
        ? 'This PDF is password-protected; unlock it first'
        : e instanceof Error
          ? e.message
          : 'Could not compress this PDF'
    reply({ type: 'error', id: msg.id, error })
  }
}
