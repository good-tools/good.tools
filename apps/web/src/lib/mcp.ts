/**
 * Browser MCP client built on the official SDK: connects over Streamable HTTP or SSE,
 * records every JSON-RPC message for the traffic log, and explains common failures.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

export type TransportKind = 'auto' | 'http' | 'sse'

export interface TrafficEntry {
  id: number
  direction: 'out' | 'in'
  time: number
  message: JSONRPCMessage
}

/** Forwards to the real transport and reports every message in both directions. */
class RecordingTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: Transport['onmessage']

  constructor(
    readonly inner: Transport,
    private record: (direction: TrafficEntry['direction'], message: JSONRPCMessage) => void,
  ) {}

  start() {
    this.inner.onmessage = (message, extra) => {
      this.record('in', message)
      this.onmessage?.(message, extra)
    }
    this.inner.onclose = () => this.onclose?.()
    this.inner.onerror = (e) => this.onerror?.(e)
    return this.inner.start()
  }

  send(message: JSONRPCMessage, options?: TransportSendOptions) {
    this.record('out', message)
    return this.inner.send(message, options)
  }

  close() {
    return this.inner.close()
  }

  get sessionId() {
    return this.inner.sessionId
  }

  setProtocolVersion = (version: string) => this.inner.setProtocolVersion?.(version)
}

export interface ConnectOptions {
  url: string
  transport: TransportKind
  headers: Record<string, string>
  onTraffic: (entry: TrafficEntry) => void
  onClose: () => void
}

export interface Connection {
  client: Client
  transport: 'http' | 'sse'
  sessionId?: string
  close: () => Promise<void>
}

let trafficId = 0

async function connectWith(kind: 'http' | 'sse', opts: ConnectOptions): Promise<Connection> {
  const url = new URL(opts.url)
  const requestInit: RequestInit = { headers: opts.headers }
  const inner =
    kind === 'http'
      ? new StreamableHTTPClientTransport(url, { requestInit })
      : new SSEClientTransport(url, { requestInit }) // the SDK applies requestInit headers to the event stream too
  const transport = new RecordingTransport(inner, (direction, message) =>
    opts.onTraffic({ id: ++trafficId, direction, time: performance.now(), message }),
  )
  const client = new Client({ name: 'good.tools MCP Browser', version: __APP_VERSION__ }, { capabilities: {} })
  client.onclose = opts.onClose
  await client.connect(transport)
  return {
    client,
    transport: kind,
    sessionId: transport.sessionId,
    close: async () => {
      if (inner instanceof StreamableHTTPClientTransport) await inner.terminateSession().catch(() => {})
      await client.close()
    },
  }
}

/** Connects; with `auto`, tries Streamable HTTP first and falls back to the legacy SSE transport. */
export async function connect(opts: ConnectOptions): Promise<Connection> {
  if (opts.transport !== 'auto') return connectWith(opts.transport, opts)
  try {
    return await connectWith('http', opts)
  } catch (httpError) {
    // Only fall back when the endpoint answered but doesn't speak Streamable HTTP
    if (!/\b(404|405)\b/.test(String(httpError))) throw httpError
    try {
      return await connectWith('sse', opts)
    } catch {
      throw httpError
    }
  }
}

/** Fetches every page of a paginated list. */
export async function listAll<T>(
  fetchPage: (cursor?: string) => Promise<{ nextCursor?: string } & Record<string, unknown>>,
  key: string,
  limit = 20,
): Promise<T[]> {
  const items: T[] = []
  let cursor: string | undefined
  for (let page = 0; page < limit; page++) {
    const res = await fetchPage(cursor)
    items.push(...((res[key] as T[] | undefined) ?? []))
    cursor = res.nextCursor
    if (!cursor) break
  }
  return items
}

/** Turns transport/protocol failures into something actionable. */
export function explainError(e: unknown, url?: string): string {
  const message = e instanceof Error ? e.message : String(e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return `Couldn't reach ${url ?? 'the server'}. Browsers can only connect to MCP servers that allow cross-origin requests (CORS) from ${location.origin}; servers that only run over stdio, or that are on a private network, can't be reached from a web page.`
  }
  if (/\b401\b|Unauthorized/i.test(message)) {
    return 'The server requires authentication (HTTP 401). Add an Authorization header, e.g. "Bearer <token>", and connect again.'
  }
  if (/\b403\b/.test(message)) return `The server refused the request (HTTP 403): ${message}`
  if (/\b(404|405)\b/.test(message)) {
    return `No MCP endpoint at this URL (${message}). Check the path: Streamable HTTP servers usually end in /mcp, SSE servers in /sse.`
  }
  if (/Invalid URL/i.test(message)) return 'Enter a full URL, e.g. https://example.com/mcp'
  return message
}

export const EXAMPLE_SERVERS = [
  { name: 'DeepWiki', url: 'https://mcp.deepwiki.com/mcp', description: 'Docs for public GitHub repositories' },
  { name: 'Context7', url: 'https://mcp.context7.com/mcp', description: 'Up-to-date library documentation' },
  { name: 'Microsoft Learn', url: 'https://learn.microsoft.com/api/mcp', description: 'Microsoft docs search' },
  {
    name: 'GitMCP (MCP TypeScript SDK)',
    url: 'https://gitmcp.io/modelcontextprotocol/typescript-sdk',
    description: 'Docs and code for one GitHub repo',
  },
] as const
