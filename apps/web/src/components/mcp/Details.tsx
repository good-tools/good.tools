import type { Prompt, Resource, ResourceTemplate, Tool } from '@modelcontextprotocol/sdk/types.js'
import { BookOpen, Braces, MessageSquare, Play, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { useToolState } from '@/hooks/useToolState'
import { explainError } from '@/lib/mcp'
import { cn } from '@/lib/utils'
import { mcpClient, useMcpStore } from '@/stores/mcp.store'
import { type Block, ContentBlock, ResourceContents } from './ContentBlocks'
import { type FormValues, initialValues, type JsonSchema, SchemaForm, toArguments } from './SchemaForm'

/** Section with a small uppercase heading, used to structure the detail pane. */
function Section({
  title,
  actions,
  children,
  className,
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('border-b last:border-0', className)}>
      <header className='flex min-h-8 items-center gap-2 bg-muted/40 py-0.5 pr-1.5 pl-3'>
        <h3 className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>{title}</h3>
        <div className='ml-auto flex items-center gap-1.5'>{actions}</div>
      </header>
      {children}
    </section>
  )
}

function Heading({
  icon: Icon,
  name,
  title,
  badges,
}: {
  icon: typeof Wrench
  name: string
  title?: string
  badges?: React.ReactNode
}) {
  return (
    <div className='flex flex-wrap items-center gap-2 px-3 pt-3'>
      <Icon className='size-4 text-muted-foreground' />
      <h2 className='font-mono text-sm font-semibold break-all'>{name}</h2>
      {title && title !== name && <span className='text-muted-foreground'>{title}</span>}
      {badges}
    </div>
  )
}

const Description = ({ text }: { text?: string }) =>
  text ? (
    <p className='px-3 pt-1 pb-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground'>{text}</p>
  ) : (
    <div className='pb-3' />
  )

type Outcome<T> = { result?: T; error?: string; ms?: number }

/** Runs an MCP request, timing it and turning failures into readable errors. */
async function run<T>(fn: () => Promise<T>): Promise<Outcome<T>> {
  const t0 = performance.now()
  try {
    return { result: await fn(), ms: performance.now() - t0 }
  } catch (e) {
    return { error: explainError(e), ms: performance.now() - t0 }
  }
}

/** Form ⇄ raw JSON argument editor shared by tools and prompts. */
function useArgumentsEditor({
  id,
  schema,
  onSubmit,
}: {
  id: string
  schema: JsonSchema | undefined
  onSubmit: (args: Record<string, unknown>) => void
}) {
  const [mode, setMode] = useToolState<'form' | 'json'>(`mcp:${id}:mode`, 'form')
  const [values, setValues] = useToolState<FormValues>(`mcp:${id}:values`, () => initialValues(schema))
  const [json, setJson] = useToolState(`mcp:${id}:json`, '{}')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    try {
      onSubmit(mode === 'form' ? toArguments(schema, values) : (JSON.parse(json) as Record<string, unknown>))
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? `Arguments must be valid JSON: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e),
      )
    }
  }

  const switchMode = (next: 'form' | 'json') => {
    // carry the arguments across so switching views doesn't lose input
    if (next === 'json') {
      try {
        setJson(JSON.stringify(toArguments(schema, values), null, 2))
      } catch {
        // incomplete form; keep the previous JSON
      }
    }
    setMode(next)
  }

  return {
    mode,
    switchMode,
    submit,
    error,
    body:
      mode === 'form' ? (
        <SchemaForm schema={schema} values={values} onChange={setValues} onSubmit={submit} idPrefix={id} />
      ) : (
        <div className='p-2'>
          <Textarea
            aria-label='Arguments (JSON)'
            rows={8}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            onCtrlEnter={submit}
          />
        </div>
      ),
  }
}

function Annotations({ tool }: { tool: Tool }) {
  const a = tool.annotations
  if (!a) return null
  return (
    <>
      {a.readOnlyHint && <Badge variant='success'>read-only</Badge>}
      {a.destructiveHint && !a.readOnlyHint && <Badge variant='warning'>destructive</Badge>}
      {a.idempotentHint && <Badge variant='outline'>idempotent</Badge>}
      {a.openWorldHint && <Badge variant='outline'>open world</Badge>}
    </>
  )
}

interface CallToolResult {
  content?: Block[]
  structuredContent?: unknown
  isError?: boolean
}

export function ToolDetail({ tool }: { tool: Tool }) {
  const [outcome, setOutcome] = useToolState<Outcome<CallToolResult> | null>(`mcp:tool:${tool.name}:outcome`, null)
  const [view, setView] = useToolState<'content' | 'raw'>(`mcp:tool:${tool.name}:view`, 'content')
  const [running, setRunning] = useState(false)
  const editor = useArgumentsEditor({
    id: `tool:${tool.name}`,
    schema: tool.inputSchema as JsonSchema,
    onSubmit: async (args) => {
      const client = mcpClient()
      if (!client) return
      setRunning(true)
      setOutcome(await run(() => client.callTool({ name: tool.name, arguments: args }) as Promise<CallToolResult>))
      setRunning(false)
    },
  })
  const result = outcome?.result

  return (
    <>
      <Heading
        icon={Wrench}
        name={tool.name}
        title={tool.title ?? tool.annotations?.title}
        badges={<Annotations tool={tool} />}
      />
      <Description text={tool.description} />
      <Section
        title='Arguments'
        actions={
          <>
            <Segmented
              label='Arguments editor'
              value={editor.mode}
              onChange={editor.switchMode}
              options={[
                ['form', 'Form'],
                ['json', 'JSON'],
              ]}
            />
            <Button size='sm' onClick={editor.submit} disabled={running} title='Run (Ctrl+Enter)'>
              {running ? <Spinner /> : <Play />} Run
            </Button>
          </>
        }
      >
        {editor.body}
        <Alert className='m-2 mt-0'>{editor.error}</Alert>
      </Section>
      {outcome && (
        <Section
          title='Result'
          actions={
            <>
              {result?.isError && <Badge variant='destructive'>Tool error</Badge>}
              {outcome.error && <Badge variant='destructive'>Request failed</Badge>}
              {result && !result.isError && <Badge variant='success'>Success</Badge>}
              <span className='text-[11px] text-muted-foreground tabular-nums'>{Math.round(outcome.ms ?? 0)} ms</span>
              {result && (
                <Segmented
                  label='Result view'
                  value={view}
                  onChange={setView}
                  options={[
                    ['content', 'Content'],
                    ['raw', 'Raw'],
                  ]}
                />
              )}
            </>
          }
        >
          <div className='flex flex-col gap-2 p-2'>
            <Alert>{outcome.error}</Alert>
            {result &&
              (view === 'raw' ? (
                <ContentBlock block={{ type: 'text', text: JSON.stringify(result) }} index={0} />
              ) : (
                <>
                  {result.content?.map((block, i) => (
                    <ContentBlock key={i} block={block} index={i} />
                  ))}
                  {result.structuredContent !== undefined && (
                    <ContentBlock
                      block={{ type: 'text', text: JSON.stringify(result.structuredContent) }}
                      index={result.content?.length ?? 0}
                    />
                  )}
                  {!result.content?.length && result.structuredContent === undefined && (
                    <p className='px-1 text-xs text-muted-foreground'>The tool returned no content.</p>
                  )}
                </>
              ))}
          </div>
        </Section>
      )}
      <SchemaSection schema={tool.inputSchema} title='Input schema' />
      {tool.outputSchema && <SchemaSection schema={tool.outputSchema} title='Output schema' />}
    </>
  )
}

function SchemaSection({ schema, title }: { schema: unknown; title: string }) {
  const [open, setOpen] = useState(false)
  const json = JSON.stringify(schema, null, 2)
  return (
    <Section
      title={title}
      actions={
        <>
          {open && <CopyButton size='icon-sm' label={`Copy ${title.toLowerCase()}`} value={json} />}
          <Button size='sm' variant='ghost' onClick={() => setOpen(!open)} aria-expanded={open}>
            <Braces /> {open ? 'Hide' : 'Show'}
          </Button>
        </>
      }
    >
      {open && <pre className='max-h-96 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap'>{json}</pre>}
    </Section>
  )
}

function ReadResult({ outcome }: { outcome: Outcome<{ contents: Block[] }> }) {
  return (
    <div className='flex flex-col gap-2 p-2'>
      <Alert>{outcome.error}</Alert>
      {outcome.result?.contents.map((c, i) => (
        <ResourceContents key={i} contents={c} label={`#${i + 1}`} />
      ))}
      {outcome.result && outcome.result.contents.length === 0 && (
        <p className='px-1 text-xs text-muted-foreground'>The resource is empty.</p>
      )}
    </div>
  )
}

function MetaTable({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className='grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 px-3 pb-3 text-xs'>
      {rows
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => (
          <div key={k} className='contents'>
            <dt className='text-muted-foreground'>{k}</dt>
            <dd className='font-mono break-all'>{v}</dd>
          </div>
        ))}
    </dl>
  )
}

export function ResourceDetail({ resource }: { resource: Resource }) {
  const [outcome, setOutcome] = useToolState<Outcome<{ contents: Block[] }> | null>(
    `mcp:resource:${resource.uri}`,
    null,
  )
  const [loading, setLoading] = useState(false)
  const read = async () => {
    const client = mcpClient()
    if (!client) return
    setLoading(true)
    setOutcome(await run(() => client.readResource({ uri: resource.uri }) as Promise<{ contents: Block[] }>))
    setLoading(false)
  }
  return (
    <>
      <Heading icon={BookOpen} name={resource.name} title={resource.title} />
      <Description text={resource.description} />
      <MetaTable
        rows={[
          ['URI', resource.uri],
          ['MIME type', resource.mimeType],
          ['Size', resource.size !== undefined ? `${resource.size.toLocaleString()} bytes` : undefined],
        ]}
      />
      <Section
        title='Contents'
        actions={
          <Button size='sm' onClick={read} disabled={loading}>
            {loading ? <Spinner /> : <Play />} Read
          </Button>
        }
      >
        {outcome && <ReadResult outcome={outcome} />}
      </Section>
    </>
  )
}

const templateVars = (template: string) => [
  ...new Set(
    [...template.matchAll(/\{[+#./;?&]?([^}]+)\}/g)].flatMap((m) =>
      m[1]!.split(',').map((v) => v.replace(/\*$|:\d+$/, '')),
    ),
  ),
]

/** Minimal RFC 6570 expansion covering the forms MCP servers use ({x}, {+x}, {/x}, {?x,y}). */
export function expandTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{([+#./;?&]?)([^}]+)\}/g, (_, op: string, names: string) => {
    const vars = names.split(',').map((n) => n.replace(/\*$|:\d+$/, ''))
    const enc = (v: string) => (op === '+' || op === '#' ? encodeURI(v) : encodeURIComponent(v))
    const present = vars.filter((v) => values[v])
    if (op === '?' || op === '&')
      return present.length ? op + present.map((v) => `${v}=${enc(values[v]!)}`).join('&') : ''
    const parts = present.map((v) => enc(values[v]!))
    if (op === '/') return parts.map((p) => `/${p}`).join('')
    if (op === '.') return parts.map((p) => `.${p}`).join('')
    return (op === '#' && parts.length ? '#' : '') + parts.join(',')
  })
}

export function TemplateDetail({ template }: { template: ResourceTemplate }) {
  const vars = templateVars(template.uriTemplate)
  const [values, setValues] = useToolState<Record<string, string>>(`mcp:template:${template.uriTemplate}:values`, {})
  const [outcome, setOutcome] = useToolState<Outcome<{ contents: Block[] }> | null>(
    `mcp:template:${template.uriTemplate}`,
    null,
  )
  const [loading, setLoading] = useState(false)
  const uri = expandTemplate(template.uriTemplate, values)
  const read = async () => {
    const client = mcpClient()
    if (!client) return
    setLoading(true)
    setOutcome(await run(() => client.readResource({ uri }) as Promise<{ contents: Block[] }>))
    setLoading(false)
  }
  return (
    <>
      <Heading
        icon={BookOpen}
        name={template.name}
        title={template.title}
        badges={<Badge variant='outline'>template</Badge>}
      />
      <Description text={template.description} />
      <MetaTable
        rows={[
          ['URI template', template.uriTemplate],
          ['MIME type', template.mimeType],
        ]}
      />
      <Section
        title='Variables'
        actions={
          <Button size='sm' onClick={read} disabled={loading}>
            {loading ? <Spinner /> : <Play />} Read
          </Button>
        }
      >
        <SchemaForm
          idPrefix={`tpl-${template.name}`}
          schema={{
            type: 'object',
            properties: Object.fromEntries(vars.map((v) => [v, { type: 'string' }])),
            required: vars,
          }}
          values={values}
          onChange={(v) => setValues(v as Record<string, string>)}
          onSubmit={read}
        />
        <p className='border-t px-3 py-2 font-mono text-[11px] break-all text-muted-foreground'>{uri}</p>
      </Section>
      {outcome && (
        <Section title='Contents'>
          <ReadResult outcome={outcome} />
        </Section>
      )}
    </>
  )
}

interface PromptMessage {
  role: string
  content: Block
}

export function PromptDetail({ prompt }: { prompt: Prompt }) {
  const [outcome, setOutcome] = useToolState<Outcome<{ description?: string; messages: PromptMessage[] }> | null>(
    `mcp:prompt:${prompt.name}`,
    null,
  )
  const [loading, setLoading] = useState(false)
  const schema: JsonSchema = {
    type: 'object',
    properties: Object.fromEntries(
      (prompt.arguments ?? []).map((a) => [a.name, { type: 'string', description: a.description }]),
    ),
    required: (prompt.arguments ?? []).filter((a) => a.required).map((a) => a.name),
  }
  const editor = useArgumentsEditor({
    id: `prompt:${prompt.name}`,
    schema,
    onSubmit: async (args) => {
      const client = mcpClient()
      if (!client) return
      setLoading(true)
      setOutcome(
        await run(
          () =>
            client.getPrompt({ name: prompt.name, arguments: args as Record<string, string> }) as Promise<{
              description?: string
              messages: PromptMessage[]
            }>,
        ),
      )
      setLoading(false)
    },
  })
  return (
    <>
      <Heading icon={MessageSquare} name={prompt.name} title={prompt.title} />
      <Description text={prompt.description} />
      <Section
        title='Arguments'
        actions={
          <Button size='sm' onClick={editor.submit} disabled={loading}>
            {loading ? <Spinner /> : <Play />} Get prompt
          </Button>
        }
      >
        {editor.body}
        <Alert className='m-2 mt-0'>{editor.error}</Alert>
      </Section>
      {outcome && (
        <Section title='Messages'>
          <div className='flex flex-col gap-2 p-2'>
            <Alert>{outcome.error}</Alert>
            {outcome.result?.messages.map((m, i) => (
              <div key={i} className='flex flex-col gap-1'>
                <Badge variant={m.role === 'assistant' ? 'default' : 'outline'} className='self-start'>
                  {m.role}
                </Badge>
                <ContentBlock block={m.content} index={i} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

function Instructions({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.split('\n').length > 8 || text.length > 600
  return (
    <Section
      title='Instructions'
      actions={
        <>
          {long && (
            <Button size='sm' variant='ghost' onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
              {expanded ? 'Show less' : 'Show all'}
            </Button>
          )}
          <CopyButton size='icon-sm' label='Copy instructions' value={text} />
        </>
      }
    >
      <p
        className={cn(
          'p-3 text-xs leading-relaxed whitespace-pre-wrap',
          long && !expanded && 'line-clamp-8 mask-b-from-60%',
        )}
      >
        {text}
      </p>
    </Section>
  )
}

export function ServerDetail() {
  const { server, tools, resources, templates, prompts, url } = useMcpStore()
  if (!server) return null
  const caps = server.capabilities ?? {}
  return (
    <>
      <div className='flex flex-wrap items-center gap-2 px-3 pt-3'>
        <h2 className='text-sm font-semibold'>{server.info?.title ?? server.info?.name ?? 'MCP server'}</h2>
        {server.info?.version && <Badge variant='outline'>v{server.info.version}</Badge>}
      </div>
      <p className='px-3 pt-0.5 pb-3 font-mono text-[11px] break-all text-muted-foreground'>{url}</p>
      <MetaTable
        rows={[
          ['Name', server.info?.name],
          ['Protocol', server.protocolVersion],
          ['Transport', server.transport === 'http' ? 'Streamable HTTP' : 'SSE (legacy)'],
          ['Session', server.sessionId],
          ['Website', server.info?.websiteUrl],
        ]}
      />
      <Section title='Capabilities'>
        <div className='flex flex-wrap gap-1.5 p-3'>
          {Object.keys(caps).length === 0 && <span className='text-xs text-muted-foreground'>None declared</span>}
          {caps.tools && <Badge variant='secondary'>tools · {tools.length}</Badge>}
          {caps.resources && <Badge variant='secondary'>resources · {resources.length + templates.length}</Badge>}
          {caps.prompts && <Badge variant='secondary'>prompts · {prompts.length}</Badge>}
          {caps.logging && <Badge variant='secondary'>logging</Badge>}
          {caps.completions && <Badge variant='secondary'>completions</Badge>}
          {caps.resources?.subscribe && <Badge variant='outline'>resource subscriptions</Badge>}
          {(caps.tools?.listChanged || caps.resources?.listChanged || caps.prompts?.listChanged) && (
            <Badge variant='outline'>list change notifications</Badge>
          )}
          {caps.experimental && <Badge variant='outline'>experimental</Badge>}
        </div>
      </Section>
      {server.instructions && <Instructions text={server.instructions} />}
    </>
  )
}
