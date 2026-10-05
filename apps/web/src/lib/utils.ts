import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 * @param inputs - Class values to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'medium' })
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/** e.g. "Monday, 5 October 2026 at 14:03:12" in the user's locale */
export function formatDateTime(date: Date | number | string): string {
  return dateTime.format(new Date(date))
}

/** e.g. "in 3 months" / "2 days ago" */
export function formatRelative(date: Date | number | string, now = Date.now()): string {
  const seconds = (new Date(date).getTime() - now) / 1000
  const [unit, size] = units.find(([, s]) => Math.abs(seconds) >= s) ?? ['second', 1]
  return relative.format(Math.round(seconds / size), unit)
}

/** Triggers a browser download of `data` as `filename`. */
export function downloadBlob(data: BlobPart | Uint8Array, filename: string, type = 'application/octet-stream') {
  // Uint8Array<ArrayBufferLike> could be a SharedArrayBuffer view in theory; ours never are
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data as BlobPart], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Fetches a .gz asset, inflating it unless the server already did (Content-Encoding: gzip). */
export async function fetchInflated(path: string): Promise<ArrayBuffer> {
  const res = await fetch(new URL(path, self.location.href))
  if (!res.ok) throw new Error(`Failed to download ${path}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  const head = new Uint8Array(buf, 0, 2)
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}
