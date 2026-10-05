// Puts Speech to Text's runtime and default model in public/whisper so the site serves them itself.
// Run with: bun src/whisper-assets.ts (the build and dev scripts do). Downloads once, then reuses the files.
// Cloudflare serves files up to 25 MiB: the model files above that are split into parts that
// workers/whisper.worker.ts joins again, and the ONNX Runtime wasm is gzipped.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'

export interface WhisperManifest {
  revision: string
  /** path in the model repo → number of parts (0 = not split) and size in bytes */
  files: Record<string, { parts: number; size: number }>
}

const REPO = 'onnx-community/whisper-tiny'
const REVISION = 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7'
const FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
]
const PART = 24 * 1024 * 1024
const OUT = 'public/whisper'

const write = (path: string, data: Uint8Array) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

// ONNX Runtime's WebAssembly build that also runs WebGPU (27 MB; 6.6 MB gzipped)
const require = createRequire(import.meta.url)
const ortVersion: string = require('onnxruntime-web/package.json').version
const ortOut = `${OUT}/ort-${ortVersion}.asyncify.wasm.gz`
if (!existsSync(ortOut))
  write(ortOut, gzipSync(readFileSync(require.resolve('onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm'))))

const dir = `${OUT}/tiny`
const manifestPath = `${dir}/manifest.json`
const current = existsSync(manifestPath) && (JSON.parse(readFileSync(manifestPath, 'utf8')) as WhisperManifest)
if (current && current.revision === REVISION && FILES.every((f) => f in current.files)) process.exit(0)

const manifest: WhisperManifest = { revision: REVISION, files: {} }
for (const file of FILES) {
  const url = `https://huggingface.co/${REPO}/resolve/${REVISION}/${file}`
  console.log(`Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const data = new Uint8Array(await res.arrayBuffer())
  const parts = data.length > PART ? Math.ceil(data.length / PART) : 0
  if (!parts) write(`${dir}/${file}`, data)
  for (let i = 0; i < parts; i++) write(`${dir}/${file}.${i}`, data.subarray(i * PART, (i + 1) * PART))
  manifest.files[file] = { parts, size: data.length }
}
writeFileSync(manifestPath, JSON.stringify(manifest))
