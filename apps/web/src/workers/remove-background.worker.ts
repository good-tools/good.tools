/** Background removal with U²-Netp (Apache-2.0) on onnxruntime-web, off the main thread. */
import type * as Ort from 'onnxruntime-web'
import jspiMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jspi.mjs?url'
import jspiWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jspi.wasm?url'
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import modelUrl from '@/assets/models/u2netp.onnx?url'
import { SIZE, toInput, toMask } from '@/lib/remove-background'

export type RemoveBgRequest = { id: number; file: Blob }
export type RemoveBgResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; backend: string }
  | { type: 'done'; id: number; blob: Blob; width: number; height: number }
  | { type: 'error'; id?: number; error: string }

const reply = (msg: RemoveBgResponse) => self.postMessage(msg)

/** Fetches every URL, reporting combined progress (total is 0 when the server sends no lengths) */
async function download(urls: string[]): Promise<ArrayBuffer[]> {
  const responses = await Promise.all(urls.map((u) => fetch(u)))
  const lengths = responses.map((r) => Number(r.headers.get('content-length')))
  const total = lengths.every(Boolean) ? lengths.reduce((a, b) => a + b) : 0
  let loaded = 0
  return Promise.all(
    responses.map(async (r) => {
      if (!r.ok || !r.body) throw new Error(`Download failed (${r.status})`)
      const chunks: Uint8Array[] = []
      for await (const chunk of r.body) {
        chunks.push(chunk)
        loaded += chunk.byteLength
        reply({ type: 'progress', loaded, total })
      }
      return new Blob(chunks as BlobPart[]).arrayBuffer()
    }),
  )
}

let runtime: Promise<{ ort: typeof Ort; session: Ort.InferenceSession }> | undefined

function load() {
  runtime ??= (async () => {
    // WebGPU needs the JSPI build (the asyncify one is over our 25 MiB per-file limit); otherwise plain wasm
    const gpu = 'Suspending' in WebAssembly && !!(await navigator.gpu?.requestAdapter().catch(() => null))
    const ort = gpu ? await import('onnxruntime-web/jspi') : await import('onnxruntime-web/wasm')
    const [wasm, model] = (await download([gpu ? jspiWasmUrl : wasmUrl, modelUrl])) as [ArrayBuffer, ArrayBuffer]
    // vite.config.ts picks ORT's builds that load their glue from wasmPaths instead of bundling it
    ort.env.wasm.wasmPaths = { mjs: gpu ? jspiMjsUrl : mjsUrl }
    ort.env.wasm.wasmBinary = wasm
    const session = await ort.InferenceSession.create(new Uint8Array(model), {
      executionProviders: gpu ? ['webgpu', 'wasm'] : ['wasm'],
    })
    reply({ type: 'ready', backend: gpu ? 'WebGPU' : 'WebAssembly' })
    return { ort, session }
  })()
  return runtime
}

async function removeBackground(file: Blob) {
  const { ort, session: s } = await load()
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This image format isn't supported, or the file is damaged")
  })
  try {
    const small = new OffscreenCanvas(SIZE, SIZE).getContext('2d', { willReadFrequently: true })
    if (!small) throw new Error('Canvas is not available')
    small.drawImage(bitmap, 0, 0, SIZE, SIZE)
    const input = new ort.Tensor('float32', toInput(small.getImageData(0, 0, SIZE, SIZE).data), [1, 3, SIZE, SIZE])
    // U²-Net has one input; its first output is the final saliency map (the others are side outputs)
    const output = await s.run({ [s.inputNames[0] as string]: input })
    const map = (await output[s.outputNames[0] as string]?.getData()) as Float32Array
    small.putImageData(new ImageData(toMask(map), SIZE, SIZE), 0, 0)

    // Keep the original pixels where the upscaled mask is opaque
    const { width, height } = bitmap
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')
    ctx.drawImage(bitmap, 0, 0)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(small.canvas, 0, 0, width, height)
    return { blob: await canvas.convertToBlob({ type: 'image/png' }), width, height }
  } finally {
    bitmap.close()
  }
}

load().catch((e: unknown) =>
  reply({ type: 'error', error: e instanceof Error ? e.message : 'The model failed to load' }),
)

// One image at a time: a session can't run twice at once
let queue = Promise.resolve()
self.onmessage = ({ data: { id, file } }: MessageEvent<RemoveBgRequest>) => {
  queue = queue.then(async () => {
    try {
      reply({ type: 'done', id, ...(await removeBackground(file)) })
    } catch (e) {
      reply({ type: 'error', id, error: e instanceof Error ? e.message : 'Could not process this image' })
    }
  })
}
