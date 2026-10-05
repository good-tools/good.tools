// Puts Speech to Text's runtime and default model in public/whisper so the site serves them itself.
// Run with: bun src/whisper-assets.ts (the build and dev scripts do). Downloads once, then reuses the files
// whose hashes match. Cloudflare serves files up to 25 MiB: the model files above that are split into parts
// that workers/whisper.worker.ts joins again, and the ONNX Runtime wasm is gzipped.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
/** SHA-256 of each file at REVISION; a download that doesn't match fails the build */
const FILES: Record<string, string> = {
  'config.json': '46aeea0a406afbeb563fc8e59ca10609203df4299af6a83f73752fef369efd2d',
  'generation_config.json': 'f5c67e5a4f7102f8cb4d058bc95da276bbc19eeec997267c3bb0f25ef68facd1',
  'preprocessor_config.json': 'a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d',
  'tokenizer.json': '27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566',
  'tokenizer_config.json': '2a4c4281cf9f51ac6ccc406fdc711a087afe6530f671fa7b80953edc498275ce',
  'onnx/encoder_model_quantized.onnx': '2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19',
  'onnx/decoder_model_merged_quantized.onnx': '25e807a962b6349356d0ea5d0dfe530b7e5bf0e2a484aeca0359d03143faddd3',
}
const PART = 24 * 1024 * 1024
const OUT = 'public/whisper'

const write = (path: string, data: Uint8Array) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}
const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')

// ONNX Runtime's WebAssembly build that also runs WebGPU (27 MB; 6.6 MB gzipped)
const require = createRequire(import.meta.url)
const ortVersion: string = require('onnxruntime-web/package.json').version
const ortOut = `${OUT}/ort-${ortVersion}.asyncify.wasm.gz`
if (!existsSync(ortOut))
  write(ortOut, gzipSync(readFileSync(require.resolve('onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm'))))

// The worker serves tiny from this site only when the manifest exists: it is written last, once every file checks out
const dir = `${OUT}/tiny`
const manifestPath = `${dir}/manifest.json`
rmSync(manifestPath, { force: true })

/** A file's local copy: the file itself, or its parts joined */
function local(file: string): Uint8Array | undefined {
  const path = `${dir}/${file}`
  if (existsSync(path)) return readFileSync(path)
  const parts: Buffer[] = []
  for (let i = 0; existsSync(`${path}.${i}`); i++) parts.push(readFileSync(`${path}.${i}`))
  return parts.length ? Buffer.concat(parts) : undefined
}

async function download(file: string, hash: string): Promise<Uint8Array> {
  const url = `https://huggingface.co/${REPO}/resolve/${REVISION}/${file}`
  console.log(`Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const data = new Uint8Array(await res.arrayBuffer())
  if (sha256(data) !== hash) {
    console.error(`ERROR: ${url} has SHA-256 ${sha256(data)}, expected ${hash}. Refusing to ship it.`)
    process.exit(1)
  }
  rmSync(`${dir}/${file}`, { force: true })
  const parts = data.length > PART ? Math.ceil(data.length / PART) : 0
  if (!parts) write(`${dir}/${file}`, data)
  for (let i = 0; i < parts; i++) write(`${dir}/${file}.${i}`, data.subarray(i * PART, (i + 1) * PART))
  return data
}

try {
  const manifest: WhisperManifest = { revision: REVISION, files: {} }
  for (const [file, hash] of Object.entries(FILES)) {
    const cached = local(file)
    const data = cached && sha256(cached) === hash ? cached : await download(file, hash)
    manifest.files[file] = { parts: data.length > PART ? Math.ceil(data.length / PART) : 0, size: data.length }
  }
  writeFileSync(manifestPath, JSON.stringify(manifest))
} catch (e) {
  // Offline and air-gapped builds still work; the tool then downloads tiny from Hugging Face in the browser
  console.warn(`WARNING: could not download Whisper tiny (${e instanceof Error ? e.message : e}).`)
  console.warn('Speech to Text will fetch it from Hugging Face at runtime instead.')
}
