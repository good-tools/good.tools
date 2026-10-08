/** Google Magika (Apache-2.0) content-type detection on onnxruntime-web, off the main thread. */

import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import * as ort from 'onnxruntime-web/wasm'
import config from '@/assets/models/magika/config.min.json'
import kb from '@/assets/models/magika/content_types_kb.min.json'
import modelUrl from '@/assets/models/magika/model.onnx?url'
import { BLOCK, type ContentTypeInfo, magikaFeatures } from '@/lib/file-identifier'

export type MagikaRequest = { id: number; file: Blob }
export interface MagikaResult {
  type: ContentTypeInfo
  score: number
  /** The model's best guesses before its confidence thresholds, highest first */
  top: { type: ContentTypeInfo; score: number }[]
}
export type MagikaResponse =
  | { type: 'ready' }
  | { type: 'done'; id: number; result: MagikaResult }
  | { type: 'error'; id?: number; error: string }

const reply = (msg: MagikaResponse) => self.postMessage(msg)
const info = (label: string): ContentTypeInfo => {
  const t = (kb as Record<string, Omit<ContentTypeInfo, 'label' | 'description'> & { description: string | null }>)[
    label
  ]
  return {
    mime_type: null,
    group: null,
    extensions: [],
    is_text: false,
    ...t,
    label,
    description: t?.description ?? label,
  }
}
const result = (label: string, score = 1, top: MagikaResult['top'] = []): MagikaResult => ({
  type: info(label),
  score,
  top,
})

let session: Promise<ort.InferenceSession> | undefined
function load() {
  session ??= (async () => {
    // vite.config.ts picks ORT's build that loads its glue from wasmPaths instead of bundling it
    ort.env.wasm.wasmPaths = { mjs: mjsUrl, wasm: wasmUrl }
    const s = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] })
    reply({ type: 'ready' })
    return s
  })()
  return session
}

// Mirrors Magika's own bindings: tiny files are text-or-not, the rest go through the model and its thresholds
async function identify(file: Blob): Promise<MagikaResult> {
  if (file.size === 0) return result('empty')
  if (file.size < config.min_file_size_for_dl) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
      return result('txt')
    } catch {
      return result('unknown')
    }
  }
  const [head, tail] = await Promise.all(
    [file.slice(0, BLOCK), file.slice(Math.max(0, file.size - BLOCK))].map(
      async (b) => new Uint8Array(await b.arrayBuffer()),
    ),
  )
  const s = await load()
  const input = magikaFeatures(head as Uint8Array, tail as Uint8Array, config)
  const out = await s.run({ [s.inputNames[0] as string]: new ort.Tensor('int32', input, [1, input.length]) })
  const scores = (await out[s.outputNames[0] as string]?.getData()) as Float32Array
  const ranked = Array.from(scores, (score, i) => ({ label: config.target_labels_space[i] as string, score })).sort(
    (a, b) => b.score - a.score,
  )
  const best = ranked[0]
  if (!best) throw new Error('The model returned no prediction')
  const thresholds = config.thresholds as Record<string, number>
  const overwrite = config.overwrite_map as Record<string, string>
  let label = overwrite[best.label] ?? best.label
  if (best.score < (thresholds[best.label] ?? config.medium_confidence_threshold))
    label = info(best.label).is_text ? 'txt' : 'unknown'
  return result(
    label,
    best.score,
    ranked.slice(0, 3).map((r) => ({ type: info(r.label), score: r.score })),
  )
}

load().catch((e: unknown) =>
  reply({ type: 'error', error: e instanceof Error ? e.message : 'The model failed to load' }),
)

// One file at a time: a session can't run twice at once
let queue = Promise.resolve()
self.onmessage = ({ data: { id, file } }: MessageEvent<MagikaRequest>) => {
  queue = queue.then(async () => {
    try {
      reply({ type: 'done', id, result: await identify(file) })
    } catch (e) {
      reply({ type: 'error', id, error: e instanceof Error ? e.message : 'Could not identify this file' })
    }
  })
}
