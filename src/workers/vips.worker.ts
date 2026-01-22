/**
 * Vips Web Worker for non-blocking image processing
 * TypeScript version for type safety
 */

import type Vips from 'wasm-vips'

// Message types for worker communication
export interface VipsWorkerMessage {
  type: 'load' | 'convert' | 'info'
  id: number
  buffer?: ArrayBuffer
  format?: OutputFormat
  options?: ConvertOptions
}

export interface VipsWorkerResponse {
  type: 'init' | 'status' | 'error' | 'loaded' | 'converted' | 'info'
  id?: number
  data?: ImageInfo | ArrayBuffer
  error?: string
  status?: string
}

export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif'

export interface ConvertOptions {
  quality?: number
  compressionLevel?: number
}

export interface ImageInfo {
  width: number
  height: number
  bands: number
  hasAlpha: boolean
}

// Singleton vips instance
let vipsInstance: typeof Vips | null = null
let initPromise: Promise<typeof Vips> | null = null

/**
 * Initialize wasm-vips
 */
async function initVips(): Promise<typeof Vips> {
  if (vipsInstance) {
    return vipsInstance
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    postMessage({ type: 'status', status: 'Loading module...' } as VipsWorkerResponse)

    // Dynamic import for vips
    const vips = await import('wasm-vips')
    const instance = await vips.default()

    vipsInstance = instance
    postMessage({ type: 'status', status: 'Ready' } as VipsWorkerResponse)
    return instance
  })()

  return initPromise
}

/**
 * Convert image to specified format
 */
function convertFormat(
  vips: typeof Vips,
  imageData: ArrayBuffer,
  format: OutputFormat,
  options: ConvertOptions = {},
): Uint8Array {
  const data = new Uint8Array(imageData)
  const image = vips.Image.newFromBuffer(data)

  if (format === 'jpeg') {
    return image.jpegsaveBuffer({ Q: options.quality || 85 })
  } else if (format === 'png') {
    return image.pngsaveBuffer({ compression: options.compressionLevel || 6 })
  } else if (format === 'webp') {
    return image.webpsaveBuffer({ Q: options.quality || 85 })
  } else if (format === 'avif') {
    return image.heifsaveBuffer({ Q: options.quality || 50, compression: 'av1' })
  }

  throw new Error(`Unsupported format: ${format}`)
}

/**
 * Get image info (width, height, hasAlpha)
 */
function getImageInfo(vips: typeof Vips, buffer: ArrayBuffer): ImageInfo {
  const data = new Uint8Array(buffer)
  const image = vips.Image.newFromBuffer(data)

  return {
    width: image.width,
    height: image.height,
    bands: image.bands,
    hasAlpha: image.hasAlpha(),
  }
}

// Initialize on worker start
initVips()
  .then(() => {
    postMessage({ type: 'init' } as VipsWorkerResponse)
  })
  .catch((e: Error) => {
    postMessage({ type: 'error', error: e.message || String(e) } as VipsWorkerResponse)
  })

// Handle messages from main thread
onmessage = async (event: MessageEvent<VipsWorkerMessage>) => {
  const { type, id, buffer, format, options } = event.data

  try {
    const vips = await initVips()

    if (type === 'load' && buffer) {
      const info = getImageInfo(vips, buffer)
      postMessage({ type: 'loaded', id, data: info } as VipsWorkerResponse)
    } else if (type === 'convert' && buffer && format) {
      self.postMessage({ type: 'status', status: `Converting to ${format.toUpperCase()}...` })

      const result = convertFormat(vips, buffer, format, options || {})
      // Transfer the ArrayBuffer to avoid copying
      const arrayBuffer = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)
      self.postMessage({ type: 'converted', id, data: arrayBuffer }, { transfer: [arrayBuffer] })
    } else if (type === 'info' && buffer) {
      const info = getImageInfo(vips, buffer)
      postMessage({ type: 'info', id, data: info } as VipsWorkerResponse)
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    postMessage({ type: 'error', id, error } as VipsWorkerResponse)
  }
}

export {}
