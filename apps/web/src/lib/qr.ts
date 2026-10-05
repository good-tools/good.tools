import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass'

export interface Wifi {
  ssid: string
  password: string
  security: WifiSecurity
  hidden: boolean
}

/** `\ ; , : "` must be backslash-escaped inside WIFI: fields. */
const esc = (s: string) => s.replace(/[\\;,:"]/g, '\\$&')

/** The de-facto Wi-Fi QR payload understood by Android and iOS cameras. */
export function wifiPayload({ ssid, password, security, hidden }: Wifi): string {
  const pass = security === 'nopass' ? '' : `P:${esc(password)};`
  return `WIFI:T:${security};S:${esc(ssid)};${pass}${hidden ? 'H:true;' : ''};`
}

/** Not in TypeScript's DOM lib yet (Chromium on Android/macOS/ChromeOS, Safari 17+ behind a flag). */
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string; format: string }[]>
}
declare const BarcodeDetector:
  | undefined
  | ((new (opts: { formats: string[] }) => BarcodeDetectorLike) & { getSupportedFormats(): Promise<string[]> })

/** BarcodeDetector format names, labelled the way zxing-cpp labels them. */
const NATIVE_LABELS: Record<string, string> = {
  aztec: 'Aztec',
  codabar: 'Codabar',
  code_39: 'Code 39',
  code_93: 'Code 93',
  code_128: 'Code 128',
  data_matrix: 'DataMatrix',
  ean_8: 'EAN-8',
  ean_13: 'EAN-13',
  itf: 'ITF',
  pdf417: 'PDF417',
  qr_code: 'QR Code',
  upc_a: 'UPC-A',
  upc_e: 'UPC-E',
}

let native: Promise<BarcodeDetectorLike | null> | undefined
const nativeDetector = () =>
  (native ??= (async () => {
    if (typeof BarcodeDetector === 'undefined') return null
    const formats = await BarcodeDetector.getSupportedFormats().catch((): string[] => [])
    return formats.length ? new BarcodeDetector({ formats }) : null
  })())

let zxing: Promise<typeof import('zxing-wasm/reader')> | undefined
const zxingReader = () =>
  (zxing ??= import('zxing-wasm/reader').then((z) => {
    // Serve the .wasm from our own origin instead of zxing-wasm's default CDN
    z.prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    })
    return z
  }))

let canvas: HTMLCanvasElement | undefined

export interface Decoded {
  text: string
  format: string
}

/**
 * Reads the first QR code or barcode in an image or a playing video frame; null when none is found.
 * Uses the browser's BarcodeDetector when available, otherwise zxing-wasm (lazy-loaded).
 */
export async function readCode(source: ImageBitmap | HTMLVideoElement): Promise<Decoded | null> {
  const detector = await nativeDetector()
  if (detector) {
    const [hit] = await detector.detect(source)
    return hit ? { text: hit.rawValue, format: NATIVE_LABELS[hit.format] ?? hit.format } : null
  }

  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height
  if (!width || !height) return null
  canvas ??= document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is not available')
  ctx.drawImage(source, 0, 0)
  const z = await zxingReader()
  const [hit] = await z.readBarcodes(ctx.getImageData(0, 0, width, height), { maxNumberOfSymbols: 1 })
  if (!hit) return null
  // zxing-cpp reports UPC-A as an EAN-13 with a leading 0, which is the same number
  if (hit.format === 'EAN13' && hit.text.startsWith('0')) return { text: hit.text.slice(1), format: 'UPC-A' }
  return { text: hit.text, format: z.formatToLabel(hit.format) ?? hit.format }
}
