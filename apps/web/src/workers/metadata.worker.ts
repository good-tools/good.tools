/** Reads and strips file metadata with ExifTool (Perl on WebAssembly) off the main thread. */
import wasmGz from 'zeroperl.wasm?gzip'
import { fetchInflated } from '@/lib/fetch-inflated'
import { compareEmbedded } from '@/lib/hidden-data'
import { type Metadata, readMetadata, stripMetadata } from '@/lib/metadata'

export type MetadataRequest = { id: number; name: string; data: Uint8Array }
export type MetadataResponse =
  | { type: 'done'; id: number; before: Metadata; output: Uint8Array<ArrayBuffer>; after: Metadata }
  | { type: 'error'; id: number; error: string }

// zeroperl only takes the fetch path when it sees a window; otherwise it reaches for node:fs
Object.assign(globalThis, { window: globalThis, document: {} })
const loader = { fetch: async () => new Response(await fetchInflated(wasmGz)) }

// One ExifTool instance with shared stdout: run one file at a time
let queue = Promise.resolve()

self.onmessage = ({ data: { id, name, data } }: MessageEvent<MetadataRequest>) => {
  queue = queue.then(async () => {
    try {
      const before = await readMetadata(name, data, loader)
      if (before.hidden) await compareEmbedded(before.hidden, data)
      const output = (await stripMetadata(name, data, loader)) as Uint8Array<ArrayBuffer>
      // Re-read the cleaned file so the UI shows what is really left, not what we meant to remove
      const after = await readMetadata(name, output, loader)
      self.postMessage({ type: 'done', id, before, output, after } satisfies MetadataResponse)
    } catch (e) {
      self.postMessage({
        type: 'error',
        id,
        error: e instanceof Error ? e.message : String(e),
      } satisfies MetadataResponse)
    }
  })
}
