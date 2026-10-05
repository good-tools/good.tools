#!/usr/bin/env node
// Produces wasm/meshrepair.{js,wasm} from native/ (C++ + VCGlib), as cheaply as possible:
//
//   1. up to date   wasm/ was built from the same inputs (wasm/inputs.sha256) → nothing to do
//   2. prebuilt     a published @goodtools/meshrepair was built from the same inputs → download
//                   its binaries (no toolchain needed: Vercel, Docker builds, forks)
//   3. compile      with Emscripten from PATH (emcc, meson, ninja), or inside the pinned builder
//                   image (tools/wasmpatch/Dockerfile.emsdk) when Docker is available
//   4. stale        preview builds only (VERCEL=1 or WASM_ALLOW_STALE=1) with no toolchain: the latest
//                   release's binaries, with a warning. Production builds never take this path.
//
// Turborepo additionally caches wasm/ by the same inputs (see turbo.json), locally and remotely.
// The inputs hash covers the native sources, the wasmpatch pins/patches/overlays and the build
// tooling, so any change that could alter the binary forces a rebuild.
import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const pkg = path.resolve(import.meta.dirname, '..')
const repo = path.resolve(pkg, '../..')
const wasmpatch = path.join(repo, 'tools/wasmpatch/wasmpatch.mjs')
const wasmDir = path.join(pkg, 'wasm')
const OUTPUTS = ['meshrepair.js', 'meshrepair.wasm']
const HASH_FILE = 'inputs.sha256'

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: pkg, stdio: 'inherit', ...opts })
const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0
const wp = (...args) => execFileSync('node', [wasmpatch, ...args], { cwd: pkg, encoding: 'utf8' }).trim()
const log = (msg) => console.log(`build-wasm: ${msg}`)

function listFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    .sort()
}

/** Everything that can change the compiled output. */
function inputsHash() {
  const hash = crypto.createHash('sha256')
  hash.update(wp('cache-key')) // upstream.json pins + patches/ + overlay/
  const files = [
    ...listFiles(path.join(pkg, 'native')),
    path.join(pkg, 'scripts/build-wasm.mjs'),
    wasmpatch,
    path.join(repo, 'tools/wasmpatch/Dockerfile.emsdk'),
  ]
  for (const file of files) {
    hash.update(path.relative(repo, file))
    hash.update(fs.readFileSync(file))
  }
  return hash.digest('hex')
}

function upToDate(hash) {
  const file = path.join(wasmDir, HASH_FILE)
  return (
    fs.existsSync(file) &&
    fs.readFileSync(file, 'utf8').trim() === hash &&
    OUTPUTS.every((f) => fs.existsSync(path.join(wasmDir, f)))
  )
}

function markBuilt(hash) {
  fs.writeFileSync(path.join(wasmDir, HASH_FILE), `${hash}\n`)
}

/**
 * Downloads the binaries of a published version that was built from exactly these inputs.
 * With `allowStale` (preview deployments only), falls back to the latest release's binaries.
 */
async function fromPublished(hash, { allowStale = false } = {}) {
  const { name, version } = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'))
  let meta
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}`)
    if (!res.ok) return false
    meta = await res.json()
  } catch {
    return false
  }
  const latest = meta['dist-tags']?.latest
  // Prefer this package version, then the latest release
  const candidates = [...new Set([version, latest])].filter((v) => meta.versions?.[v])
  for (const v of candidates) {
    const extracted = await download(meta.versions[v].dist)
    if (!extracted) continue
    try {
      const published = path.join(extracted, 'package/dist', HASH_FILE)
      const matches = fs.existsSync(published) && fs.readFileSync(published, 'utf8').trim() === hash
      if (!matches && !(allowStale && v === latest)) continue
      fs.mkdirSync(wasmDir, { recursive: true })
      for (const f of OUTPUTS) fs.copyFileSync(path.join(extracted, 'package/dist', f), path.join(wasmDir, f))
      if (matches) {
        markBuilt(hash)
        log(`using the prebuilt binaries of ${name}@${v} (same inputs)`)
      } else {
        // never matches a real inputs hash, so the next build with a toolchain rebuilds
        fs.writeFileSync(path.join(wasmDir, HASH_FILE), `stale-from-${v}\n`)
        const msg = `the native inputs changed since ${name}@${v}; this PREVIEW uses that release's binaries`
        console.warn(
          process.env.GITHUB_ACTIONS || process.env.VERCEL
            ? `::warning::build-wasm: ${msg}`
            : `build-wasm: WARNING: ${msg}`,
        )
      }
      return true
    } finally {
      fs.rmSync(extracted, { recursive: true, force: true })
    }
  }
  return false
}

/** Fetches and unpacks a registry tarball after checking its integrity; returns the temp dir. */
async function download(dist) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meshrepair-'))
  try {
    const res = await fetch(dist.tarball)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    const [algo, expected] = dist.integrity.split('-')
    if (crypto.createHash(algo).update(bytes).digest('base64') !== expected) throw new Error('integrity mismatch')
    fs.writeFileSync(path.join(tmp, 'pkg.tgz'), bytes)
    execFileSync('tar', ['xzf', path.join(tmp, 'pkg.tgz'), '-C', tmp])
    return tmp
  } catch {
    fs.rmSync(tmp, { recursive: true, force: true })
    return null
  }
}

function compile(hash) {
  run('node', [wasmpatch, 'apply'])
  const out = path.join(pkg, 'build/native')
  const configured = fs.existsSync(path.join(out, 'build.ninja'))
  run('meson', [
    'setup',
    out,
    'native',
    ...(configured ? ['--reconfigure'] : []),
    '--cross-file',
    'native/crossfile.meson',
    '--buildtype',
    'release',
    '--backend',
    'ninja',
  ])
  run('meson', ['compile', '-C', out])
  fs.mkdirSync(wasmDir, { recursive: true })
  for (const f of OUTPUTS) fs.copyFileSync(path.join(out, f), path.join(wasmDir, f))
  markBuilt(hash)
  log('compiled wasm/meshrepair.{js,wasm}')
}

function compileInDocker() {
  const emsdk = wp('print', 'toolchain.emsdk')
  const meson = wp('print', 'toolchain.meson')
  const image = `good-tools/emsdk:${emsdk}-${meson}`
  if (spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore' }).status !== 0) {
    run('docker', [
      'build',
      '-f',
      path.join(repo, 'tools/wasmpatch/Dockerfile.emsdk'),
      '--build-arg',
      `EMSDK_VERSION=${emsdk}`,
      '--build-arg',
      `MESON_VERSION=${meson}`,
      '-t',
      image,
      path.join(repo, 'tools/wasmpatch'),
    ])
  }
  const user = process.getuid ? ['--user', `${process.getuid()}:${process.getgid()}`] : []
  run('docker', [
    'run',
    '--rm',
    ...user,
    '-v',
    `${repo}:/src`,
    '-w',
    '/src/packages/meshrepair',
    image,
    'node',
    'scripts/build-wasm.mjs',
    '--compile',
  ])
}

const hash = inputsHash()
if (process.argv.includes('--compile')) {
  compile(hash) // inside the builder image
} else if (upToDate(hash)) {
  log('up to date')
} else if (!process.argv.includes('--no-prebuilt') && (await fromPublished(hash))) {
  // done
} else if (has('emcc')) {
  compile(hash)
} else if (has('docker')) {
  compileInDocker()
} else if (
  // Preview deployments (Vercel; production is built in CI) may fall back to the last release
  (process.env.VERCEL === '1' || process.env.WASM_ALLOW_STALE === '1') &&
  (await fromPublished(hash, { allowStale: true }))
) {
  // done, with a warning
} else {
  console.error(
    'build-wasm: no published @goodtools/meshrepair was built from these native inputs, and neither\n' +
      'Emscripten (emcc on PATH) nor Docker is available to compile them. Install Docker, or let CI build it.',
  )
  process.exit(1)
}
