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

export type ResizeMode = 'none' | 'percentage' | 'width' | 'height' | 'dimensions'

export interface ResizeOptions {
  mode: ResizeMode
  percentage?: number
  width?: number
  height?: number
}

export interface ConvertOptions {
  quality?: number
  compressionLevel?: number
  resize?: ResizeOptions
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
 * Resize image based on options
 */
function resizeImage(vips: typeof Vips, image: Vips.Image, options?: ResizeOptions): Vips.Image {
  if (!options || options.mode === 'none') {
    return image
  }

  const originalWidth = image.width
  const originalHeight = image.height
  const aspectRatio = originalWidth / originalHeight

  let targetWidth = originalWidth
  let targetHeight = originalHeight

  if (options.mode === 'percentage') {
    const scale = (options.percentage || 100) / 100
    targetWidth = Math.round(originalWidth * scale)
    targetHeight = Math.round(originalHeight * scale)
  } else if (options.mode === 'width') {
    targetWidth = options.width || originalWidth
    targetHeight = Math.round(targetWidth / aspectRatio)
  } else if (options.mode === 'height') {
    targetHeight = options.height || originalHeight
    targetWidth = Math.round(targetHeight * aspectRatio)
  } else if (options.mode === 'dimensions') {
    targetWidth = options.width || originalWidth
    targetHeight = options.height || originalHeight
  }

  // Ensure minimum dimensions
  targetWidth = Math.max(1, targetWidth)
  targetHeight = Math.max(1, targetHeight)

  // No resize needed if same dimensions
  if (targetWidth === originalWidth && targetHeight === originalHeight) {
    return image
  }

  // Use resize with scale factor
  const hScale = targetWidth / originalWidth
  const vScale = targetHeight / originalHeight

  return image.resize(hScale, { vscale: vScale })
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
  let image = vips.Image.newFromBuffer(data)

  // Apply resize if requested
  image = resizeImage(vips, image, options.resize)

  switch (format) {
    case 'jpeg':
      return image.jpegsaveBuffer({ Q: options.quality || 85 })
    case 'png':
      return image.pngsaveBuffer({ compression: options.compressionLevel || 6 })
    case 'webp':
      return image.webpsaveBuffer({ Q: options.quality || 85 })
    case 'avif':
      return image.heifsaveBuffer({ Q: options.quality || 50, compression: 'av1' })
    default: {
      const _exhaustiveCheck: never = format
      throw new Error(`Unsupported format: ${String(_exhaustiveCheck)}`)
    }
  }
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
