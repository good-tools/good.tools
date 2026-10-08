import { filesize } from 'filesize'
import { FilePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  extensionOf,
  hexRows,
  matchSignature,
  type Signature,
  type Status,
  type Verdict,
  verdict,
} from '@/lib/file-identifier'
import { cn } from '@/lib/utils'
import type { MagikaRequest, MagikaResponse, MagikaResult } from '@/workers/magika.worker'

interface Item {
  id: number
  file: File
  /** First bytes, for the signature check and the hex preview */
  head: Uint8Array
  sig: Signature | null
  magika?: MagikaResult
  verdict?: Verdict
  error?: string
}

const HEAD = 512
const PREVIEW = 256

const STATUS: Record<Status, [BadgeVariant, string]> = {
  match: ['success', 'Match'],
  mismatch: ['warning', 'Mismatch'],
  danger: ['destructive', 'Disguised'],
  unknown: ['outline', 'Unclear'],
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

let nextId = 0

export default function FileIdentifier() {
  const [items, setItems] = useToolState<Item[]>('fileid:items', [])
  const [selectedId, setSelectedId] = useToolState<number | null>('fileid:selected', null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const worker = useRef<Worker | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    const w = new Worker(new URL('../workers/magika.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onerror = (e) => setError(`The detection worker failed to load: ${e.message}`)
    w.onmessage = ({ data: msg }: MessageEvent<MagikaResponse>) => {
      if (msg.type === 'ready') setReady(true)
      else if (msg.type === 'error' && msg.id === undefined) setError(msg.error)
      else
        setItems((list) =>
          list.map((it) =>
            it.id !== msg.id
              ? it
              : msg.type === 'done'
                ? { ...it, magika: msg.result, verdict: verdict(extensionOf(it.file.name), msg.result.type, it.sig) }
                : { ...it, error: msg.error },
          ),
        )
    }
    // Files still waiting when the tool was left are sent again
    for (const it of itemsRef.current)
      if (!it.magika && !it.error) w.postMessage({ id: it.id, file: it.file } satisfies MagikaRequest)
    return () => {
      w.terminate()
      worker.current = null
    }
  }, [setItems])

  const add = async (files: File[]) => {
    const added = await Promise.all(
      files.map(async (file) => {
        const head = new Uint8Array(await file.slice(0, HEAD).arrayBuffer())
        return { id: nextId++, file, head, sig: matchSignature(head) }
      }),
    )
    const [first] = added
    if (!first) return
    for (const it of added) worker.current?.postMessage({ id: it.id, file: it.file } satisfies MagikaRequest)
    setItems((list) => [...list, ...added])
    setSelectedId(first.id)
  }

  const clear = () => {
    setItems([])
    setSelectedId(null)
  }

  const loading = !ready && !error && <Spinner label='Loading model…' />
  const selected = items.find((it) => it.id === selectedId) ?? items[0]
  const pending = items.filter((it) => !it.magika && !it.error).length
  const flagged = items.filter((it) => it.verdict?.status === 'mismatch' || it.verdict?.status === 'danger').length

  if (!selected)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          multiple
          onFiles={add}
          hint='Any file type. Detection runs on your device with Google Magika; files are never uploaded.'
        >
          Drop files here or click to browse
        </DropZone>
        {loading}
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <DropTarget onFiles={add} label='Drop to add files'>
      <Workspace
        toolbar={
          <>
            <FileButton
              size='sm'
              variant='ghost'
              multiple
              onFileSelected={(e) => add(Array.from(e.target.files ?? []))}
            >
              <FilePlus /> Add files
            </FileButton>
            <Button size='sm' variant='ghost' onClick={clear}>
              <Trash2 /> Clear
            </Button>
            {loading || (pending > 0 && <Spinner label={`Identifying${pending > 1 ? ` (${pending} left)` : ''}…`} />)}
            <span className='ml-auto text-xs text-muted-foreground'>
              {items.length} {items.length === 1 ? 'file' : 'files'}
              {flagged > 0 && <span className='text-warning'> · {flagged} flagged</span>}
            </span>
          </>
        }
      >
        <Alert>{error}</Alert>
        <Split>
          <Panel title='Files'>
            <table className='w-full table-fixed text-[13px]'>
              <thead className='sticky top-0 bg-card text-[11px] text-muted-foreground'>
                <tr className='h-7 border-b'>
                  <th className='px-2.5 text-left font-medium'>File</th>
                  <th className='w-[35%] px-2.5 text-left font-medium'>Detected</th>
                  <th className='w-24 px-2.5 text-right font-medium'>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className={cn('h-8 border-b', it.id === selected.id && 'bg-accent')}>
                    <td className='truncate px-2.5'>
                      <button
                        type='button'
                        className='w-full truncate text-left hover:underline'
                        title={it.file.name}
                        aria-pressed={it.id === selected.id}
                        onClick={() => setSelectedId(it.id)}
                      >
                        {it.file.name}
                      </button>
                    </td>
                    <td className='truncate px-2.5 text-muted-foreground' title={it.magika?.type.description}>
                      {it.magika?.type.label}
                    </td>
                    <td className='px-2.5 text-right'>
                      <StatusBadge item={it} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Details item={selected} />
        </Split>
      </Workspace>
    </DropTarget>
  )
}

function StatusBadge({ item }: { item: Item }) {
  if (item.error) return <Badge variant='destructive'>Error</Badge>
  if (!item.verdict) return <Spinner />
  const [variant, text] = STATUS[item.verdict.status]
  return <Badge variant={variant}>{text}</Badge>
}

function Details({ item }: { item: Item }) {
  const { file, magika, sig } = item
  const ext = extensionOf(file.name)
  const rows = hexRows(item.head.subarray(0, PREVIEW))
  const dump = rows.map((r) => `${r[0]}  ${r[1].padEnd(47)}  ${r[2]}`).join('\n')
  const v = item.verdict
  // An object, not tuples: JSX inside array literals trips the iterable-key lint
  const fields: Record<string, React.ReactNode> = {
    Size: `${filesize(file.size, { base: 2 })} (${file.size.toLocaleString()} bytes)`,
    Extension: ext ? `.${ext}` : <span className='text-muted-foreground'>none</span>,
    'Browser MIME': file.type || <span className='text-muted-foreground'>none</span>,
    Magika: magika ? (
      <>
        {magika.type.description} <span className='text-muted-foreground'>({magika.type.label})</span>
      </>
    ) : (
      !item.error && <Spinner />
    ),
    'Detected MIME': magika?.type.mime_type,
    Group: magika?.type.group,
    Confidence: magika && (
      <span className={cn('font-mono tabular-nums', magika.score < 0.5 && 'text-warning')}>{pct(magika.score)}</span>
    ),
    'Top guesses': magika?.top.length ? (
      <span className='font-mono text-xs'>{magika.top.map((t) => `${t.type.label} ${pct(t.score)}`).join(' · ')}</span>
    ) : null,
    Signature: sig ? sig.name : <span className='text-muted-foreground'>no known magic bytes</span>,
  }

  return (
    <div className='flex min-h-0 flex-col gap-2'>
      <Panel
        title='Details'
        className='shrink-0'
        actions={<span className='max-w-60 truncate px-1.5 text-xs text-muted-foreground'>{file.name}</span>}
      >
        <Alert>{item.error}</Alert>
        {v && (
          <div
            className={cn(
              'border-b px-2.5 py-1.5 text-[13px] font-medium',
              { match: 'text-success', mismatch: 'text-warning', danger: 'text-destructive', unknown: '' }[v.status],
            )}
          >
            {v.reason}
          </div>
        )}
        <dl className='text-[13px]'>
          {Object.entries(fields).map(
            ([k, val]) =>
              val != null &&
              val !== false &&
              val !== '' && (
                <div key={k} className='flex min-h-7 items-baseline gap-2 border-b py-1 pr-1 pl-2.5 last:border-0'>
                  <dt className='w-28 shrink-0 text-xs text-muted-foreground'>{k}</dt>
                  <dd className='min-w-0 flex-1 break-words'>{val}</dd>
                </div>
              ),
          )}
        </dl>
      </Panel>
      <Panel
        title={`First ${Math.min(PREVIEW, file.size)} bytes`}
        className='min-h-32 flex-1'
        actions={<CopyButton size='icon-sm' label='Copy hex dump' value={dump} disabled={!dump} />}
      >
        <pre className='p-2.5 font-mono text-xs leading-5'>
          {rows.map(([off, hex, ascii]) => (
            <div key={off}>
              <span className='text-muted-foreground'>{off}</span> {hex.padEnd(47)}{' '}
              <span className='text-muted-foreground'>{ascii}</span>
            </div>
          ))}
        </pre>
      </Panel>
    </div>
  )
}
