/** wasm-vips image conversion off the main thread. */
import type Vips from 'wasm-vips'

export type OutputFormat = 'jpeg' | 'png' | 'webp'
export interface ConvertOptions {
  quality?: number
  /** Exact output size in pixels; omitted = keep original size */
  resize?: { width: number; height: number }
}

export interface ImageInfo {
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
  | { type: 'loaded'; id: number; data: ImageInfo }
  | { type: 'converted'; id: number; format: OutputFormat; data: ArrayBuffer }

const reply = (msg: VipsWorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, { transfer })

let initPromise: Promise<typeof Vips> | null = null

function initVips(): Promise<typeof Vips> {
  initPromise ??= (async () => {
    reply({ type: 'status', status: 'Loading module...' })
    const vips = await import('wasm-vips')
    // Don't load optional dynamic modules (vips-jxl, vips-heif); their wasm isn't bundled
    return vips.default({ dynamicLibraries: [] })
  })()
  return initPromise
}

function convert(vips: typeof Vips, buffer: ArrayBuffer, format: OutputFormat, options: ConvertOptions = {}) {
  const images: Vips.Image[] = []
  try {
    let image = vips.Image.newFromBuffer(new Uint8Array(buffer))
    images.push(image)
    const size = options.resize
    if (size && (size.width !== image.width || size.height !== image.height)) {
      image = image.resize(size.width / image.width, { vscale: size.height / image.height })
      images.push(image)
    }
    const Q = options.quality || 85
    if (format === 'jpeg') return image.jpegsaveBuffer({ Q })
    if (format === 'webp') return image.webpsaveBuffer({ Q })
    return image.pngsaveBuffer()
  } finally {
    // vips images live on the wasm heap; free them or every conversion leaks
    for (const img of images) img.delete()
  }
}

function info(vips: typeof Vips, buffer: ArrayBuffer): ImageInfo {
  const image = vips.Image.newFromBuffer(new Uint8Array(buffer))
  try {
    return { width: image.width, height: image.height, bands: image.bands, hasAlpha: image.hasAlpha() }
  } finally {
    image.delete()
  }
}

initVips()
  .then(() => reply({ type: 'init' }))
  .catch((e: unknown) => reply({ type: 'error', error: e instanceof Error ? e.message : String(e) }))

self.onmessage = async (event: MessageEvent<VipsWorkerMessage>) => {
  const msg = event.data
  try {
    const vips = await initVips()
    if (msg.type === 'load') {
      reply({ type: 'loaded', id: msg.id, data: info(vips, msg.buffer) })
    } else {
      reply({ type: 'status', status: `Converting to ${msg.format.toUpperCase()}...` })
      const out = convert(vips, msg.buffer, msg.format, msg.options)
      const data = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
      reply({ type: 'converted', id: msg.id, format: msg.format, data }, [data])
    }
  } catch (err) {
    reply({ type: 'error', id: msg.id, error: err instanceof Error ? err.message : String(err) })
  }
}
