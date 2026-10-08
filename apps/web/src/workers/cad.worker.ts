/** Tessellates STEP, IGES and BREP files with OpenCascade (occt-import-js) off the main thread. */
import occtimportjs from 'occt-import-js'
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'
import { type CadFormat, type CadModel, fromOcct, type OcctResult } from '@/lib/cad'

export interface CadRequest {
  id: number
  format: CadFormat
  data: Uint8Array
}
export type CadResponse =
  | { type: 'ready' }
  | { type: 'done'; id: number; model: CadModel }
  | { type: 'error'; id?: number; error: string }

const reply = (msg: CadResponse, transfer: Transferable[] = []) => self.postMessage(msg, { transfer })
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const ready = occtimportjs({ locateFile: () => wasmUrl })
ready.then(
  () => reply({ type: 'ready' }),
  (e: unknown) => reply({ type: 'error', error: `Failed to load OpenCascade: ${message(e)}` }),
)

self.onmessage = async ({ data: { id, format, data } }: MessageEvent<CadRequest>) => {
  try {
    const occt = await ready
    // Library defaults: millimetres, deflection relative to the bounding box
    const result = occt.ReadFile(format, data, null) as OcctResult
    if (!result.success) throw new Error(`Could not read this ${format.toUpperCase()} file`)
    const model = fromOcct(result)
    if (!model.meshes.length) throw new Error('The file contains no solid or surface geometry')
    reply(
      { type: 'done', id, model },
      model.meshes.flatMap((m) => [m.position.buffer, m.index.buffer, ...(m.normal ? [m.normal.buffer] : [])]),
    )
  } catch (e) {
    reply({ type: 'error', id, error: message(e) })
  }
}
