/** Parses an executable, hashes it and extracts strings off the main thread. */
import { md } from 'node-forge'
import { type BinaryInfo, type FoundString, findStrings, parseBinary } from '@/lib/binary'

export type BinaryRequest =
  | { type: 'parse'; id: number; bytes: Uint8Array }
  | { type: 'strings'; id: number; bytes: Uint8Array; min: number }

export type BinaryResponse =
  | { type: 'parsed'; id: number; info: BinaryInfo | null; error?: string; hashes: [string, string][] }
  | { type: 'strings'; id: number; strings: FoundString[]; truncated: boolean }

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

async function hashes(b: Uint8Array): Promise<[string, string][]> {
  const m = md.md5.create()
  // node-forge takes binary strings; feed it in chunks so large files don't build one huge string
  for (let i = 0; i < b.length; i += 0x8000) m.update(String.fromCharCode(...b.subarray(i, i + 0x8000)))
  const subtle = await Promise.all(
    (['SHA-1', 'SHA-256'] as const).map(
      async (a) => [a, toHex(await crypto.subtle.digest(a, b as Uint8Array<ArrayBuffer>))] as [string, string],
    ),
  )
  return [['MD5', m.digest().toHex()], ...subtle]
}

self.onmessage = async ({ data: req }: MessageEvent<BinaryRequest>) => {
  if (req.type === 'parse') {
    const { bytes } = req
    let info: BinaryInfo | null = null
    let error: string | undefined
    try {
      info = parseBinary(bytes)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    self.postMessage({ type: 'parsed', id: req.id, info, error, hashes: await hashes(bytes) } satisfies BinaryResponse)
  } else {
    self.postMessage({ type: 'strings', id: req.id, ...findStrings(req.bytes, req.min) } satisfies BinaryResponse)
  }
}
