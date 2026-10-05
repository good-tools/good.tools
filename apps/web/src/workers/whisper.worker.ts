/** Whisper speech recognition (Transformers.js + ONNX Runtime) off the main thread. */
import { type AutomaticSpeechRecognitionPipeline, env, pipeline, type Tensor } from '@huggingface/transformers'
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'
import { fetchInflated } from '@/lib/fetch-inflated'
import type { Cue } from '@/lib/subtitles'
import type { WhisperManifest } from '@/whisper-assets'

export type WhisperModel = 'tiny' | 'base' | 'small'

/** `audio` is 16 kHz mono; an empty `language` means detect it */
export interface WhisperRequest {
  audio: Float32Array
  model: WhisperModel
  language: string
}

export type WhisperResponse =
  | { type: 'download'; loaded: number; total: number }
  | { type: 'status'; status: string }
  | { type: 'result'; cues: Cue[]; language: string }
  | { type: 'error'; error: string }

const RATE = 16000
const reply = (msg: WhisperResponse) => self.postMessage(msg)

// ONNX Runtime's "asyncify" build runs both WASM and WebGPU; src/whisper-assets.ts puts it, gzipped, on this site
const onnx = env.backends.onnx
const runtime = (async () => {
  if (!onnx.wasm) return
  onnx.wasm.wasmPaths = { mjs: ortMjs }
  onnx.wasm.wasmBinary = await fetchInflated(`/whisper/ort-${onnx.versions?.web}.asyncify.wasm.gz`)
})()

// The tiny model is served from this site too, its large files split in parts (see src/whisper-assets.ts).
// Transformers.js asks for Hugging Face URLs; answer those for whisper-tiny with the joined local files.
// Without a manifest (the build was offline) tiny comes from Hugging Face like the other models.
const TINY = 'https://huggingface.co/onnx-community/whisper-tiny/resolve/'
const manifest: Promise<WhisperManifest | null> = fetch('/whisper/tiny/manifest.json')
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null) // includes an SPA fallback page that isn't JSON
const hubFetch = env.fetch
env.fetch = async (input, init) => {
  const url = String(input)
  const files = (await manifest)?.files
  if (!files || !url.startsWith(TINY)) return hubFetch(input, init)
  const file = url.slice(TINY.length).replace(/^[^/]+\//, '') // drop the revision
  const entry = files[file]
  if (!entry) return new Response(null, { status: 404 })
  const base = `/whisper/tiny/${file}`
  const parts = entry.parts ? Array.from({ length: entry.parts }, (_, i) => `${base}.${i}`) : [base]
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        for (;;) {
          if (!reader) {
            const next = parts.shift()
            if (!next) return controller.close()
            const res = await fetch(next)
            if (!res.ok || !res.body) throw new Error(`Failed to download ${next}: HTTP ${res.status}`)
            reader = res.body.getReader()
          }
          const { done, value } = await reader.read()
          if (!done) return controller.enqueue(value)
          reader = undefined
        }
      },
      cancel: () => reader?.cancel(),
    },
    { highWaterMark: 0 }, // fetch nothing until read: metadata requests only look at the headers
  )
  return new Response(body, { headers: { 'content-length': String(entry.size) } })
}

const webgpu = (async () => {
  try {
    const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return !!(await gpu?.requestAdapter())
  } catch {
    return false
  }
})()

let loaded: { model: WhisperModel; pipe: Promise<AutomaticSpeechRecognitionPipeline> } | null = null

async function load(model: WhisperModel) {
  if (loaded?.model === model) return loaded.pipe
  void loaded?.pipe.then((p) => p.dispose()).catch(() => {})
  await runtime
  // Tiny is quick on the CPU; base and small use the GPU when there is one, with the settings of
  // Transformers.js' own WebGPU Whisper demo
  const gpu = model !== 'tiny' && (await webgpu)
  const pipe = pipeline('automatic-speech-recognition', `onnx-community/whisper-${model}`, {
    revision: (model === 'tiny' && (await manifest)?.revision) || 'main',
    device: gpu ? 'webgpu' : 'wasm',
    dtype: gpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (p) => {
      if (p.status === 'progress_total') reply({ type: 'download', loaded: p.loaded, total: p.total })
    },
  })
  loaded = { model, pipe }
  pipe.catch(() => {
    if (loaded?.pipe === pipe) loaded = null // retry the download next time
  })
  return pipe
}

/** Whisper's first decoded token after start-of-transcript is the language, e.g. <|de|>. Falls back to English. */
async function detectLanguage(pipe: AutomaticSpeechRecognitionPipeline, audio: Float32Array) {
  const { input_features } = await pipe.processor(audio.subarray(0, 30 * RATE))
  const config = pipe.model.generation_config as unknown as {
    decoder_start_token_id: number
    lang_to_id: Record<string, number>
  }
  const out = (await pipe.model.generate({
    inputs: input_features,
    decoder_input_ids: [config.decoder_start_token_id],
    max_new_tokens: 1,
  } as never)) as Tensor
  const id = Number((out.tolist() as bigint[][])[0]?.[1])
  const token = Object.keys(config.lang_to_id).find((k) => config.lang_to_id[k] === id)
  return token?.slice(2, -2) ?? 'en'
}

self.onmessage = async ({ data: { audio, model, language } }: MessageEvent<WhisperRequest>) => {
  try {
    reply({ type: 'status', status: 'Loading model…' })
    const pipe = await load(model)
    if (!language) {
      reply({ type: 'status', status: 'Detecting language…' })
      language = await detectLanguage(pipe, audio)
    }
    // The pipeline cuts audio into 30 s windows overlapping by 5 s on each side; the streamer's end()
    // runs after each window is decoded (sometimes more), which is our progress.
    const windows = audio.length <= 30 * RATE ? 1 : Math.ceil((audio.length - 30 * RATE) / (20 * RATE)) + 1
    let done = 0
    const progress = () => `Transcribing… ${Math.round((Math.min(done, windows) / windows) * 100)}%`
    reply({ type: 'status', status: progress() })
    const streamer = {
      put() {},
      end() {
        done++
        reply({ type: 'status', status: progress() })
      },
    }
    const out = await pipe(audio, {
      language,
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      streamer,
    } as never)
    const duration = audio.length / RATE
    const chunks = (out as { chunks?: { timestamp: [number | null, number | null]; text: string }[] }).chunks ?? []
    const cues = chunks.map(({ timestamp: [start, end], text }) => ({
      start: start ?? 0,
      end: Math.min(end ?? duration, duration),
      text,
    }))
    reply({ type: 'result', cues, language })
  } catch (e) {
    reply({ type: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}
