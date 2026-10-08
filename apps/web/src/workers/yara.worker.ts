/** Compiles YARA rules and scans samples with YARA-X (wasm) off the main thread, so a runaway scan can be killed. */
import init from '@virustotal/yara-x'
import { compileAndScan, type Sample, type YaraResult } from '@/lib/yara'

export interface YaraRequest {
  source: string
  samples: Sample[]
}

export type YaraResponse = { type: 'start' } | { type: 'done'; result: YaraResult } | { type: 'error'; error: string }

// Starts loading the wasm as soon as the worker is created
const ready = init()

self.onmessage = async ({ data }: MessageEvent<YaraRequest>) => {
  const reply = (r: YaraResponse) => self.postMessage(r)
  try {
    await ready
    reply({ type: 'start' })
    reply({ type: 'done', result: compileAndScan(data.source, data.samples) })
  } catch (e) {
    reply({ type: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}
