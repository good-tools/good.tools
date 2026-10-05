import { useSyncExternalStore } from 'react'
import type { WiregasmMethods } from '@/workers/wiregasm.worker'

type Event = { event: 'status'; message: string } | { event: 'ready' } | { event: 'error'; message: string }
type Reply = { id: number; result?: unknown; error?: string }

export type WiregasmClient = {
  call: <M extends keyof WiregasmMethods>(
    method: M,
    ...args: Parameters<WiregasmMethods[M]>
  ) => Promise<ReturnType<WiregasmMethods[M]>>
  terminate: () => void
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
    call: (method, ...args) => {
      const id = nextId++
      const transfer = args.filter((a): a is ArrayBuffer => a instanceof ArrayBuffer)
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
        worker.postMessage({ id, method, args }, transfer)
      })
    },
    terminate: () => {
      worker.terminate()
      for (const p of pending.values()) p.reject(new Error('Worker terminated'))
      pending.clear()
    },
  }
}

type SharedState = { status: string; ready: boolean; error: string | null }
type Shared = { client: WiregasmClient; state: SharedState; listeners: Set<() => void> }
let shared: Shared | null = null

/**
 * One Wireshark worker for the whole session: it costs a ~20 MB download and holds the loaded
 * capture, so it is kept alive when the user navigates away from the Packet Dissector and back.
 */
function getShared() {
  if (!shared) {
    const s: Shared = {
      client: null as unknown as WiregasmClient,
      state: { status: 'Loading…', ready: false, error: null },
      listeners: new Set(),
    }
    const update = (patch: Partial<SharedState>) => {
      s.state = { ...s.state, ...patch } // new object so useSyncExternalStore sees the change
      s.listeners.forEach((l) => l())
    }
    s.client = createWiregasmClient((e) => {
      if (e.event === 'status') update({ status: e.message })
      else if (e.event === 'error') update({ error: e.message })
      else update({ ready: true, status: 'Ready' })
    })
    shared = s
  }
  return shared
}

/** The shared wiregasm client plus its startup state (status message, ready, fatal error). */
export function useWiregasm() {
  const s = getShared()
  const state = useSyncExternalStore(
    (onChange) => {
      s.listeners.add(onChange)
      return () => s.listeners.delete(onChange)
    },
    () => s.state,
  )
  return { client: s.client, ...state }
}
