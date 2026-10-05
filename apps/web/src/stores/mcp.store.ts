import type {
  Implementation,
  Prompt,
  Resource,
  ResourceTemplate,
  ServerCapabilities,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { create } from 'zustand'
import { type Connection, connect, explainError, listAll, type TrafficEntry, type TransportKind } from '@/lib/mcp'

export interface HeaderRow {
  id: number
  key: string
  value: string
  enabled: boolean
}

export type Selection =
  | { kind: 'tool'; name: string }
  | { kind: 'resource'; uri: string }
  | { kind: 'template'; uriTemplate: string }
  | { kind: 'prompt'; name: string }
  | { kind: 'server' }

interface ServerState {
  info?: Implementation
  capabilities?: ServerCapabilities
  instructions?: string
  protocolVersion?: string
  transport: 'http' | 'sse'
  sessionId?: string
}

interface McpState {
  // connection form (kept for the session, never persisted to storage)
  url: string
  transport: TransportKind
  headers: HeaderRow[]
  setUrl: (url: string) => void
  setTransport: (t: TransportKind) => void
  setHeaders: (h: HeaderRow[]) => void

  status: 'idle' | 'connecting' | 'connected'
  error: string | null
  server: ServerState | null
  tools: Tool[]
  resources: Resource[]
  templates: ResourceTemplate[]
  prompts: Prompt[]
  listErrors: Partial<Record<'tools' | 'resources' | 'templates' | 'prompts', string>>
  traffic: TrafficEntry[]
  selected: Selection | null

  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refresh: () => Promise<void>
  select: (s: Selection | null) => void
  clearTraffic: () => void
}

const MAX_TRAFFIC = 1000
let connection: Connection | null = null
let nextHeaderId = 1

export const newHeader = (key = '', value = ''): HeaderRow => ({ id: nextHeaderId++, key, value, enabled: true })

/** The live SDK client, or null when disconnected. */
export const mcpClient = () => connection?.client ?? null

export const useMcpStore = create<McpState>()((set, get) => {
  const refreshList = async <K extends 'tools' | 'resources' | 'templates' | 'prompts'>(
    key: K,
    load: () => Promise<McpState[K]>,
  ) => {
    try {
      const items = await load()
      set((s) => ({ [key]: items, listErrors: { ...s.listErrors, [key]: undefined } }) as Partial<McpState>)
    } catch (e) {
      set((s) => ({ [key]: [], listErrors: { ...s.listErrors, [key]: explainError(e) } }) as Partial<McpState>)
    }
  }

  return {
    url: '',
    transport: 'auto',
    headers: [],
    setUrl: (url) => set({ url }),
    setTransport: (transport) => set({ transport }),
    setHeaders: (headers) => set({ headers }),

    status: 'idle',
    error: null,
    server: null,
    tools: [],
    resources: [],
    templates: [],
    prompts: [],
    listErrors: {},
    traffic: [],
    selected: null,

    connect: async () => {
      await get().disconnect()
      const { url, transport, headers } = get()
      set({ status: 'connecting', error: null, traffic: [], selected: null })
      try {
        const conn = await connect({
          url: url.trim(),
          transport,
          headers: Object.fromEntries(
            headers.filter((h) => h.enabled && h.key.trim()).map((h) => [h.key.trim(), h.value]),
          ),
          onTraffic: (entry) => {
            set((s) => ({ traffic: [...s.traffic.slice(-(MAX_TRAFFIC - 1)), entry] }))
            // Servers announce list changes; keep the sidebar current
            const method = 'method' in entry.message ? entry.message.method : ''
            if (entry.direction === 'in' && method.endsWith('/list_changed')) void get().refresh()
          },
          onClose: () => {
            if (connection?.client === conn.client) {
              connection = null
              set({ status: 'idle', error: get().status === 'connected' ? 'The server closed the connection.' : null })
            }
          },
        })
        connection = conn
        const init = get().traffic.find(
          (t) => t.direction === 'in' && 'result' in t.message && 'protocolVersion' in (t.message.result as object),
        )
        set({
          status: 'connected',
          selected: { kind: 'server' },
          server: {
            info: conn.client.getServerVersion(),
            capabilities: conn.client.getServerCapabilities(),
            instructions: conn.client.getInstructions(),
            protocolVersion: init && 'result' in init.message ? String(init.message.result.protocolVersion) : undefined,
            transport: conn.transport,
            sessionId: conn.sessionId,
          },
        })
        await get().refresh()
      } catch (e) {
        connection = null
        set({ status: 'idle', error: explainError(e, url) })
      }
    },

    disconnect: async () => {
      const conn = connection
      connection = null
      set({ status: 'idle', server: null, tools: [], resources: [], templates: [], prompts: [], listErrors: {} })
      await conn?.close().catch(() => {})
    },

    refresh: async () => {
      const client = connection?.client
      const caps = get().server?.capabilities
      if (!client || !caps) return
      await Promise.all([
        caps.tools && refreshList('tools', () => listAll<Tool>((cursor) => client.listTools({ cursor }), 'tools')),
        caps.resources &&
          refreshList('resources', () => listAll<Resource>((cursor) => client.listResources({ cursor }), 'resources')),
        caps.resources &&
          refreshList('templates', () =>
            listAll<ResourceTemplate>((cursor) => client.listResourceTemplates({ cursor }), 'resourceTemplates'),
          ),
        caps.prompts &&
          refreshList('prompts', () => listAll<Prompt>((cursor) => client.listPrompts({ cursor }), 'prompts')),
      ])
    },

    select: (selected) => set({ selected }),
    clearTraffic: () => set({ traffic: [] }),
  }
})
