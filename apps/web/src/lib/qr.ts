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
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>
}
declare const BarcodeDetector:
  | undefined
  | ((new (opts: { formats: string[] }) => BarcodeDetectorLike) & { getSupportedFormats(): Promise<string[]> })

let native: Promise<BarcodeDetectorLike | null> | undefined
const nativeDetector = () =>
  (native ??= (async () => {
    if (typeof BarcodeDetector === 'undefined') return null
    const formats = await BarcodeDetector.getSupportedFormats().catch((): string[] => [])
    return formats.includes('qr_code') ? new BarcodeDetector({ formats: ['qr_code'] }) : null
  })())

let canvas: HTMLCanvasElement | undefined

/**
 * Reads a QR code from an image or a playing video frame; null when none is found.
 * Uses the browser's BarcodeDetector when it supports QR, otherwise jsQR (lazy-loaded).
 */
export async function readQr(source: ImageBitmap | HTMLVideoElement): Promise<string | null> {
  const detector = await nativeDetector()
  if (detector) return (await detector.detect(source))[0]?.rawValue ?? null

  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height
  if (!width || !height) return null
  canvas ??= document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is not available')
  ctx.drawImage(source, 0, 0)
  const { default: jsQR } = await import('jsqr')
  return jsQR(ctx.getImageData(0, 0, width, height).data, width, height)?.data ?? null
}
