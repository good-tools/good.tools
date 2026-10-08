/// <reference lib="webworker" />
/** Runs pandoc (WebAssembly) off the main thread. One request at a time; the instance is reused. */
import { createPandocInstance } from 'pandoc-wasm/src/core.js'
import wasmGz from 'pandoc-wasm/src/pandoc.wasm?gzip'
import { fetchInflated } from '@/lib/fetch-inflated'

export interface PandocRequest {
  id: number
  options: Record<string, unknown>
  /** Text input (stdin) */
  text?: string
  /** Binary input, stored under options['input-files'][0] */
  file?: Blob
}

export type PandocResponse =
  | { type: 'ready'; version: string }
  | { type: 'done'; id: number; text: string; file?: Blob; warnings: string[] }
  | { type: 'error'; id?: number; error: string }

const reply = (msg: PandocResponse) => self.postMessage(msg)
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// The 56 MB wasm is shipped gzipped (~16 MB)
const wasm = fetchInflated(wasmGz)
let ready = wasm.then(createPandocInstance)
ready.then(
  (p) => reply({ type: 'ready', version: String(p.query({ query: 'version' })) }),
  (e: unknown) => reply({ type: 'error', error: `Failed to load pandoc: ${message(e)}` }),
)

self.onmessage = async ({ data: { id, options, text, file } }: MessageEvent<PandocRequest>) => {
  try {
    const pandoc = await ready
    const inputs = file ? { [(options['input-files'] as string[])[0]!]: file } : {}
    const out = options['output-file'] as string | undefined
    const res = await pandoc.convert(options, text ?? null, inputs)
    const output = out ? res.files[out] : undefined
    if (res.stderr.trim() || (out && !output)) throw new Error(res.stderr.trim() || 'pandoc produced no output')
    reply({ type: 'done', id, text: res.stdout, file: output, warnings: warnings(res.warnings) })
  } catch (e) {
    // A trap (e.g. out of memory) leaves the instance unusable; start a fresh one for the next request
    if (e instanceof WebAssembly.RuntimeError) ready = wasm.then(createPandocInstance)
    reply({ type: 'error', id, error: message(e) })
  }
}

interface LogMessage {
  verbosity?: string
  pretty?: string
}

/** pandoc's log as text, without INFO messages (like "no lang specified") */
const warnings = (log: LogMessage[]) =>
  log.filter((w) => w.verbosity !== 'INFO').map((w) => w.pretty ?? JSON.stringify(w))
