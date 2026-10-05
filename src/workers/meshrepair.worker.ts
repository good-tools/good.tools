/** Runs @goodtools/meshrepair off the main thread so repairs don't freeze the UI. */
import { MeshRepair, type RepairOptions, type RepairResult } from '@goodtools/meshrepair'
// @ts-expect-error - No type declarations for WASM loader subpath export
import loadMeshRepair from '@goodtools/meshrepair/dist/meshrepair.js'
import wasmPath from '@goodtools/meshrepair/dist/meshrepair.wasm?url'

export interface MeshRepairRequest {
  id: number
  name: string
  data: Uint8Array
  options: RepairOptions
}

export type MeshRepairResponse =
  | { type: 'ready' }
  | { type: 'progress'; id: number; step: string; value: number }
  | { type: 'done'; id: number; result: RepairResult; output: Uint8Array<ArrayBuffer> }
  | { type: 'error'; id?: number; error: string }

const reply = (msg: MeshRepairResponse, transfer: Transferable[] = []) => self.postMessage(msg, { transfer })
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const ready = MeshRepair.init(loadMeshRepair as never, {
  locateFile: (path) => (path.endsWith('.wasm') ? wasmPath : path),
})
ready.then(
  () => reply({ type: 'ready' }),
  (e: unknown) => reply({ type: 'error', error: `Failed to initialize MeshRepair: ${message(e)}` }),
)

self.onmessage = async ({ data: { id, name, data, options } }: MessageEvent<MeshRepairRequest>) => {
  try {
    const mr = await ready
    const { result, output } = mr.repair(name, data, options, (step, value) =>
      reply({ type: 'progress', id, step, value }),
    )
    if (result.code !== 0) throw new Error(result.error || 'Repair failed')
    reply({ type: 'done', id, result, output: output as Uint8Array<ArrayBuffer> }, [output.buffer])
  } catch (e) {
    reply({ type: 'error', id, error: message(e) })
  }
}
