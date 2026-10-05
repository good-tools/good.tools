/** wasm-vips image conversion off the main thread. */
import type Vips from 'wasm-vips'
import vipsUrl from 'wasm-vips/vips.wasm?url'
import heifUrl from 'wasm-vips/vips-heif.wasm?url'

export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif'
export interface ConvertOptions {
  quality?: number
  /** Exact output size in pixels; omitted = keep original size */
  resize?: { width: number; height: number }
  /** Keep EXIF/XMP/IPTC (camera, GPS…); by default only the colour profile is kept */
  keepMetadata?: boolean
}

export interface ImageInfo {
  /** Size as displayed, i.e. after applying the EXIF orientation */
  width: number
  height: number
  bands: number
  hasAlpha: boolean
}

export type VipsRequest =
  | { type: 'load'; buffer: ArrayBuffer }
  | { type: 'convert'; buffer: ArrayBuffer; format: OutputFormat; options?: ConvertOptions }

/** Every request carries an id that is echoed in its reply */
export type VipsWorkerMessage = VipsRequest & { id: number }

export type VipsWorkerResponse =
  | { type: 'init' }
  | { type: 'status'; status: string }
  | { type: 'error'; id?: number; error: string }
  /** `decoded` is set when the browser had to decode the file: a PNG to send instead of the original */
  | { type: 'loaded'; id: number; data: ImageInfo; decoded?: ArrayBuffer }
  | { type: 'converted'; id: number; format: OutputFormat; data: ArrayBuffer }

/** Worker name that loads the HEIF module (AVIF output). It adds 3.8 MB, so only that worker loads it. */
export const HEIF_WORKER = 'vips-heif'

const reply = (msg: VipsWorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, { transfer })
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

let initPromise: Promise<typeof Vips> | null = null

function initVips(): Promise<typeof Vips> {
  initPromise ??= (async () => {
    const heif = self.name === HEIF_WORKER
    reply({ type: 'status', status: heif ? 'Loading AVIF encoder...' : 'Loading module...' })
    const vips = await import('wasm-vips')
    return vips.default({
      // vips-jxl is never loaded; vips-heif only when this worker encodes AVIF
      dynamicLibraries: heif ? ['vips-heif.wasm'] : [],
      // Point emscripten at the bundled (hashed) wasm files
      locateFile: (file: string, prefix: string) =>
        file === 'vips.wasm' ? vipsUrl : file === 'vips-heif.wasm' ? heifUrl : prefix + file,
    })
  })()
  return initPromise
}

/**
 * Opens an image, upright. Formats this vips build can't read (AVIF without the HEIF module,
 * HEIC in Safari…) are decoded by the browser and returned as PNG in `decoded`.
 */
async function open(vips: typeof Vips, buffer: ArrayBuffer): Promise<{ image: Vips.Image; decoded?: ArrayBuffer }> {
  let raw: Vips.Image
  try {
    raw = vips.Image.newFromBuffer(new Uint8Array(buffer))
  } catch {
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(new Blob([buffer])) // applies EXIF orientation itself
    } catch {
      throw new Error("This image format isn't supported, or the file is damaged")
    }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      throw new Error("This browser can't decode this image format")
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const decoded = await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
    return { image: vips.Image.newFromBuffer(new Uint8Array(decoded)), decoded }
  }
  // Phone photos store pixels sideways plus an orientation tag; rotate them so sizes match what people see
  try {
    return { image: raw.autorot() }
  } finally {
    raw.delete()
  }
}

async function convert(vips: typeof Vips, buffer: ArrayBuffer, format: OutputFormat, options: ConvertOptions = {}) {
  const images: Vips.Image[] = []
  try {
    let image = (await open(vips, buffer)).image
    images.push(image)
    const size = options.resize
    if (size && (size.width !== image.width || size.height !== image.height)) {
      image = image.resize(size.width / image.width, { vscale: size.height / image.height })
      images.push(image)
    }
    // JPEG has no transparency: put transparent areas on white instead of black
    if (format === 'jpeg' && image.hasAlpha()) {
      image = image.flatten({ background: [255, 255, 255] })
      images.push(image)
    }
    const Q = options.quality || 85
    // Without keepMetadata only the ICC profile survives, so colours (e.g. Display P3 photos) stay right
    const keep = options.keepMetadata ? 'all' : 'icc'
    if (format === 'jpeg') return image.jpegsaveBuffer({ Q, keep })
    if (format === 'webp') return image.webpsaveBuffer({ Q, keep })
    if (format === 'avif') return image.heifsaveBuffer({ Q, compression: 'av1', keep })
    return image.pngsaveBuffer({ keep })
  } finally {
    // vips images live on the wasm heap; free them or every conversion leaks
    for (const img of images) img.delete()
  }
}

async function info(vips: typeof Vips, buffer: ArrayBuffer) {
  const { image, decoded } = await open(vips, buffer)
  try {
    const data = { width: image.width, height: image.height, bands: image.bands, hasAlpha: image.hasAlpha() }
    return { data, decoded }
  } finally {
    image.delete()
  }
}

initVips()
  .then(() => reply({ type: 'init' }))
  .catch((e: unknown) => reply({ type: 'error', error: message(e, 'The image module failed to load') }))

self.onmessage = async (event: MessageEvent<VipsWorkerMessage>) => {
  const msg = event.data
  try {
    const vips = await initVips()
    if (msg.type === 'load') {
      const { data, decoded } = await info(vips, msg.buffer)
      reply({ type: 'loaded', id: msg.id, data, decoded }, decoded ? [decoded] : [])
    } else {
      reply({ type: 'status', status: `Converting to ${msg.format.toUpperCase()}...` })
      const out = await convert(vips, msg.buffer, msg.format, msg.options)
      const data = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
      reply({ type: 'converted', id: msg.id, format: msg.format, data }, [data])
    }
  } catch (err) {
    // vips throws WebAssembly exceptions, which have no useful message
    reply({ type: 'error', id: msg.id, error: message(err, 'Could not process this image') })
  }
}
