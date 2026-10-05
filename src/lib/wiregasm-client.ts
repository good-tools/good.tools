import type { WiregasmMethods } from '@/workers/wiregasm.worker'

type Event = { event: 'status'; message: string } | { event: 'ready' } | { event: 'error'; message: string }
type Reply = { id: number; result?: unknown; error?: string }

export type WiregasmClient = {
  call<M extends keyof WiregasmMethods>(
    method: M,
    ...args: Parameters<WiregasmMethods[M]>
  ): Promise<ReturnType<WiregasmMethods[M]>>
  terminate(): void
}

/** Spawns the wiregasm worker; calls are queued in the worker until Wireshark has loaded. */
export function createWiregasmClient(onEvent: (e: Event) => void): WiregasmClient {
  const worker = new Worker(new URL('../workers/wiregasm.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  let nextId = 0

  worker.onmessage = (e: MessageEvent<Event | Reply>) => {
    if ('event' in e.data) return onEvent(e.data)
    const { id, result, error } = e.data
    const p = pending.get(id)
    pending.delete(id)
    if (error !== undefined) p?.reject(new Error(error))
    else p?.resolve(result)
  }
  worker.onerror = (e) => onEvent({ event: 'error', message: e.message || 'Failed to start worker' })

  return {
    call(method, ...args) {
      const id = nextId++
      const transfer = args.filter((a): a is ArrayBuffer => a instanceof ArrayBuffer)
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
        worker.postMessage({ id, method, args }, transfer)
      })
    },
    terminate() {
      worker.terminate()
      for (const p of pending.values()) p.reject(new Error('Worker terminated'))
      pending.clear()
    },
  }
}
