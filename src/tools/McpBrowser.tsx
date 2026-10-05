import type { Prompt, Resource, ResourceTemplate, Tool } from '@modelcontextprotocol/sdk/types.js'
import {
  Activity,
  BookOpen,
  FileCode2,
  KeyRound,
  MessageSquare,
  Plug,
  PlugZap,
  RefreshCw,
  Search,
  Server,
  Unplug,
  Wrench,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PromptDetail, ResourceDetail, ServerDetail, TemplateDetail, ToolDetail } from '@/components/mcp/Details'
import { HeadersEditor } from '@/components/mcp/HeadersEditor'
import { TrafficLog } from '@/components/mcp/TrafficLog'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { EXAMPLE_SERVERS, type TransportKind } from '@/lib/mcp'
import { cn } from '@/lib/utils'
import { type Selection, useMcpStore } from '@/stores/mcp.store'

type Item =
  | { kind: 'tool'; key: string; label: string; hint?: string; value: Tool }
  | { kind: 'resource'; key: string; label: string; hint?: string; value: Resource }
  | { kind: 'template'; key: string; label: string; hint?: string; value: ResourceTemplate }
  | { kind: 'prompt'; key: string; label: string; hint?: string; value: Prompt }

const SECTIONS = [
  { kind: 'tool', title: 'Tools', icon: Wrench },
  { kind: 'resource', title: 'Resources', icon: BookOpen },
  { kind: 'template', title: 'Templates', icon: FileCode2 },
  { kind: 'prompt', title: 'Prompts', icon: MessageSquare },
] as const

const LIST_KEY = { tool: 'tools', resource: 'resources', template: 'templates', prompt: 'prompts' } as const

const selectionKey = (s: Selection | null) =>
  !s
    ? ''
    : s.kind === 'server'
      ? 'server'
      : `${s.kind}:${s.kind === 'resource' ? s.uri : s.kind === 'template' ? s.uriTemplate : s.name}`

function toSelection(item: Item): Selection {
  if (item.kind === 'resource') return { kind: 'resource', uri: item.value.uri }
  if (item.kind === 'template') return { kind: 'template', uriTemplate: item.value.uriTemplate }
  return { kind: item.kind, name: item.value.name }
}

function Sidebar() {
  const { server, tools, resources, templates, prompts, listErrors, selected, select } = useMcpStore()
  const [filter, setFilter] = useState('')

  const items = useMemo((): Item[] => {
    const all: Item[] = [
      ...tools.map((t) => ({
        kind: 'tool' as const,
        key: `tool:${t.name}`,
        label: t.name,
        hint: t.title ?? t.description,
        value: t,
      })),
      ...resources.map((r) => ({
        kind: 'resource' as const,
        key: `resource:${r.uri}`,
        label: r.name,
        hint: r.uri,
        value: r,
      })),
      ...templates.map((t) => ({
        kind: 'template' as const,
        key: `template:${t.uriTemplate}`,
        label: t.name,
        hint: t.uriTemplate,
        value: t,
      })),
      ...prompts.map((p) => ({
        kind: 'prompt' as const,
        key: `prompt:${p.name}`,
        label: p.name,
        hint: p.title ?? p.description,
        value: p,
      })),
    ]
    const q = filter.trim().toLowerCase()
    return q ? all.filter((i) => `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(q)) : all
  }, [tools, resources, templates, prompts, filter])

  const current = selectionKey(selected)

  return (
    <Panel className='w-full lg:w-72 lg:shrink-0'>
      <div className='flex flex-col'>
        <button
          type='button'
          onClick={() => select({ kind: 'server' })}
          className={cn(
            'flex items-center gap-2 border-b px-3 py-2 text-left hover:bg-accent/60',
            current === 'server' && 'bg-accent',
          )}
        >
          <Server className='size-4 shrink-0 text-muted-foreground' />
          <span className='min-w-0'>
            <span className='block truncate text-[13px] font-medium'>{server?.info?.title ?? server?.info?.name}</span>
            <span className='block text-[11px] text-muted-foreground'>
              {server?.info?.version && `v${server.info.version} · `}
              {server?.transport === 'http' ? 'Streamable HTTP' : 'SSE'}
            </span>
          </span>
        </button>
        <div className='relative border-b p-1.5'>
          <Search className='pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
          <Input
            aria-label='Filter tools, resources and prompts'
            placeholder='Filter…'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className='h-7 pl-7 text-xs'
          />
        </div>
        {SECTIONS.map(({ kind, title, icon: Icon }) => {
          const list = items.filter((i) => i.kind === kind)
          const total = { tool: tools, resource: resources, template: templates, prompt: prompts }[kind].length
          const error = listErrors[LIST_KEY[kind]]
          if (total === 0 && !error) return null
          return (
            <div key={kind} className='py-1'>
              <h3 className='flex items-center gap-1.5 px-3 pt-1 pb-0.5 text-[10.5px] font-medium tracking-wider text-muted-foreground/80 uppercase'>
                <Icon className='size-3' />
                {title}
                <span className='ml-auto font-normal tabular-nums'>
                  {list.length !== total ? `${list.length}/${total}` : total}
                </span>
              </h3>
              {error && <p className='px-3 text-[11px] text-destructive'>{error}</p>}
              {list.map((item) => (
                <button
                  type='button'
                  key={item.key}
                  title={item.hint}
                  onClick={() => select(toSelection(item))}
                  className={cn(
                    'flex w-full flex-col px-3 py-1 text-left hover:bg-accent/60',
                    current === item.key && 'bg-accent',
                  )}
                >
                  <span className='truncate font-mono text-xs'>{item.label}</span>
                  {item.hint && <span className='truncate text-[11px] text-muted-foreground'>{item.hint}</span>}
                </button>
              ))}
            </div>
          )
        })}
        {items.length === 0 && filter && (
          <p className='px-3 py-2 text-xs text-muted-foreground'>Nothing matches “{filter}”.</p>
        )}
      </div>
    </Panel>
  )
}

function Detail() {
  const { selected, tools, resources, templates, prompts } = useMcpStore()
  let content: React.ReactNode = <ServerDetail />
  if (selected?.kind === 'tool') {
    const t = tools.find((x) => x.name === selected.name)
    if (t) content = <ToolDetail key={t.name} tool={t} />
  } else if (selected?.kind === 'resource') {
    const r = resources.find((x) => x.uri === selected.uri)
    if (r) content = <ResourceDetail key={r.uri} resource={r} />
  } else if (selected?.kind === 'template') {
    const t = templates.find((x) => x.uriTemplate === selected.uriTemplate)
    if (t) content = <TemplateDetail key={t.uriTemplate} template={t} />
  } else if (selected?.kind === 'prompt') {
    const p = prompts.find((x) => x.name === selected.name)
    if (p) content = <PromptDetail key={p.name} prompt={p} />
  }
  return <Panel className='min-w-0 flex-1'>{content}</Panel>
}

function Welcome({ onPick }: { onPick: (url: string) => void }) {
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-4 py-6'>
      <div>
        <h2 className='flex items-center gap-2 text-sm font-semibold'>
          <Plug className='size-4' /> Connect to an MCP server
        </h2>
        <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
          Browse a remote{' '}
          <a
            className='underline underline-offset-2'
            href='https://modelcontextprotocol.io'
            target='_blank'
            rel='noreferrer'
          >
            Model Context Protocol
          </a>{' '}
          server's tools, resources and prompts, call them with generated forms, and inspect every JSON-RPC message.
          Your browser connects directly to the server; nothing goes through good.tools. The server must allow
          cross-origin requests (CORS).
        </p>
      </div>
      <div>
        <h3 className='mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
          Public servers to try
        </h3>
        <div className='grid gap-1.5 sm:grid-cols-2'>
          {EXAMPLE_SERVERS.map((s) => (
            <button
              type='button'
              key={s.url}
              onClick={() => onPick(s.url)}
              className='group flex flex-col rounded-md border px-3 py-2 text-left transition-colors hover:border-foreground/30 hover:bg-accent/50'
            >
              <span className='flex items-center gap-1.5 text-[13px] font-medium'>
                <PlugZap className='size-3.5 text-muted-foreground group-hover:text-foreground' />
                {s.name}
              </span>
              <span className='text-xs text-muted-foreground'>{s.description}</span>
              <span className='mt-1 truncate font-mono text-[11px] text-muted-foreground'>{s.url}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function McpBrowser() {
  const store = useMcpStore()
  const { url, transport, headers, status, error, server, traffic } = store
  const [showHeaders, setShowHeaders] = useToolState('mcp:showHeaders', false)
  const [showTraffic, setShowTraffic] = useToolState('mcp:showTraffic', false)
  const activeHeaders = headers.filter((h) => h.enabled && h.key.trim()).length
  const connected = status === 'connected'

  const connectTo = (u?: string) => {
    if (u) store.setUrl(u)
    void store.connect()
  }

  return (
    <Workspace
      toolbar={
        <>
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              connected
                ? 'bg-success'
                : status === 'connecting'
                  ? 'animate-pulse bg-warning'
                  : 'bg-muted-foreground/40',
            )}
            title={status}
          />
          <Input
            aria-label='MCP server URL'
            placeholder='https://example.com/mcp'
            value={url}
            onChange={(e) => store.setUrl(e.target.value)}
            onEnter={() => url.trim() && connectTo()}
            className='h-7 max-w-xl flex-1 font-mono text-xs'
            spellCheck={false}
          />
          <Segmented<TransportKind>
            label='Transport'
            value={transport}
            onChange={store.setTransport}
            options={[
              ['auto', 'Auto'],
              ['http', 'HTTP'],
              ['sse', 'SSE'],
            ]}
          />
          <Button
            size='sm'
            variant={showHeaders ? 'secondary' : 'ghost'}
            onClick={() => setShowHeaders(!showHeaders)}
            aria-expanded={showHeaders}
          >
            <KeyRound /> Headers
            {activeHeaders > 0 && <Badge variant='outline'>{activeHeaders}</Badge>}
          </Button>
          {connected ? (
            <>
              <Button
                size='sm'
                variant='outline'
                onClick={() => connectTo()}
                title='Reconnect with the current URL and headers'
              >
                <RefreshCw /> Reconnect
              </Button>
              <Button size='sm' variant='ghost' onClick={() => void store.disconnect()}>
                <Unplug /> Disconnect
              </Button>
            </>
          ) : (
            <Button size='sm' onClick={() => connectTo()} disabled={!url.trim() || status === 'connecting'}>
              {status === 'connecting' ? <Spinner /> : <Plug />} Connect
            </Button>
          )}
          <Button
            size='sm'
            variant={showTraffic ? 'secondary' : 'ghost'}
            className='ml-auto'
            onClick={() => setShowTraffic(!showTraffic)}
            aria-expanded={showTraffic}
          >
            <Activity /> Traffic
            {traffic.length > 0 && <Badge variant='outline'>{traffic.length}</Badge>}
          </Button>
        </>
      }
    >
      {showHeaders && (
        <Panel title='Request headers' className='shrink-0'>
          <div className='p-2'>
            <HeadersEditor headers={headers} onChange={store.setHeaders} />
          </div>
        </Panel>
      )}
      <Alert>{error}</Alert>
      <div className='flex min-h-0 flex-1 flex-col gap-2'>
        <div className='flex min-h-0 flex-1 flex-col gap-2 lg:flex-row'>
          {connected && server ? (
            <>
              <Sidebar />
              <Detail />
            </>
          ) : status === 'connecting' ? (
            <div className='flex flex-1 items-center justify-center'>
              <Spinner label={`Connecting to ${url}…`} />
            </div>
          ) : (
            <div className='flex-1 overflow-auto'>
              <Welcome onPick={connectTo} />
            </div>
          )}
        </div>
        {showTraffic && (
          <div className='h-56 shrink-0 overflow-hidden rounded-md border bg-card'>
            <TrafficLog traffic={traffic} onClear={store.clearTraffic} />
          </div>
        )}
      </div>
    </Workspace>
  )
}
