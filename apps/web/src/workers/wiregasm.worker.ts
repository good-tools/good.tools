/// <reference lib="webworker" />
/**
 * Wireshark (wiregasm) running in a dedicated worker.
 *
 * Protocol: the page posts `{ id, method, args }`; the worker answers `{ id, result }` or `{ id, error }`.
 * Unsolicited events (`{ event: 'status' | 'ready' | 'error', ... }`) report startup progress.
 * See src/lib/wiregasm-client.ts for the typed client.
 */
import { vectorToArray, Wiregasm, type WiregasmLoader } from '@goodtools/wiregasm'
// @ts-expect-error emscripten loader ships without types
import loadWiregasm from '@goodtools/wiregasm/dist/wiregasm'
import dataPath from '@goodtools/wiregasm/dist/wiregasm.data.gz?url'
import wasmPath from '@goodtools/wiregasm/dist/wiregasm.wasm.gz?url'
import { fetchInflated } from '@/lib/fetch-inflated'

declare const self: DedicatedWorkerGlobalScope

const wg = new Wiregasm()

const status = (message: string) => self.postMessage({ event: 'status', message })

const ready = (async () => {
  status('Downloading Wireshark…')
  const [wasmBinary, data] = await Promise.all([fetchInflated(wasmPath), fetchInflated(dataPath)])
  status('Starting Wireshark…')
  await wg.init(loadWiregasm as WiregasmLoader, {
    wasmBinary,
    getPreloadedPackage: () => data,
    handleStatus: (_type: number, message: string) => status(message),
  })
})()

ready.then(
  () => self.postMessage({ event: 'ready' }),
  (e: unknown) => self.postMessage({ event: 'error', message: errorMessage(e) }),
)

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Embind vectors aren't cloneable; convert them to arrays recursively. */
function plain<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) =>
      (v as { constructor?: { name?: string } } | null)?.constructor?.name?.startsWith('Vector')
        ? vectorToArray(v as Parameters<typeof vectorToArray>[0])
        : v,
    ),
  ) as T
}

const methods = {
  version: () => wg.lib.wiresharkVersion(),
  columns: () => wg.columns(),
  checkFilter: (filter: string) => {
    const res = wg.lib.checkFilter(filter)
    if (!res.ok) throw new Error(res.error)
    return true
  },
  load: (name: string, data: ArrayBuffer) => plain(wg.load(name, new Uint8Array(data))),
  reload: () => (wg.session ? plain(wg.session.load()) : null),
  frames: (filter: string, skip: number, limit: number) => plain(wg.frames(filter, skip, limit)),
  frame: (number: number) => plain(wg.frame(number)),
  listModules: () => plain(wg.listModules()),
  listPrefs: (module: string) => plain(wg.listPrefs(module)),
  setPref: (module: string, key: string, value: string) => wg.setPref(module, key, value),
  applyPrefs: () => wg.applyPrefs(),
  /** Writes a file (e.g. TLS keylog) into the wasm FS and returns its path. */
  uploadFile: (name: string, data: ArrayBuffer) => {
    const path = `${wg.uploadDir}/${name.replace(/[/\\]/g, '_')}`
    wg.lib.FS.writeFile(path, new Uint8Array(data))
    return path
  },
}

export type WiregasmMethods = typeof methods

self.onmessage = async (e: MessageEvent<{ id: number; method: keyof WiregasmMethods; args: unknown[] }>) => {
  const { id, method, args } = e.data
  try {
    await ready
    const fn = methods[method] as (...a: unknown[]) => unknown
    self.postMessage({ id, result: fn(...args) })
  } catch (err) {
    self.postMessage({ id, error: errorMessage(err) })
  }
}
