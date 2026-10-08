import { zipSync } from 'fflate'
import { Download, FilePlus, MapPin, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { cleanName, type Metadata } from '@/lib/metadata'
import { cn, downloadBlob } from '@/lib/utils'
import type { MetadataRequest, MetadataResponse } from '@/workers/metadata.worker'

interface Item {
  id: number
  file: File
  before?: Metadata
  after?: Metadata
  output?: Uint8Array<ArrayBuffer>
  error?: string
}

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.tif,.tiff,.pdf,.docx,.xlsx,.pptx,image/*,application/pdf'

/** Tags that describe the file itself (size, type, dimensions), not metadata someone wrote into it */
const countTags = (m?: Metadata) => m?.groups.reduce((n, g) => n + (g.name === 'File' ? 0 : g.tags.length), 0) ?? 0

let nextId = 0

export default function MetadataStripper() {
  const [items, setItems] = useToolState<Item[]>('metadata:items', [])
  const [selectedId, setSelectedId] = useToolState<number | null>('metadata:selected', null)
  const [view, setView] = useToolState<'before' | 'after'>('metadata:view', 'before')
  const [error, setError] = useState<string | null>(null)
  const worker = useRef<Worker | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    const w = new Worker(new URL('../workers/metadata.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onerror = (e) => setError(`The metadata worker failed to load: ${e.message}`)
    w.onmessage = ({ data: msg }: MessageEvent<MetadataResponse>) =>
      setItems((list) =>
        list.map((it) =>
          it.id !== msg.id
            ? it
            : msg.type === 'done'
              ? { ...it, before: msg.before, after: msg.after, output: msg.output }
              : { ...it, error: msg.error },
        ),
      )
    // Files still waiting when the tool was left are sent again
    for (const it of itemsRef.current) if (!it.output && !it.error) send(w, it)
    return () => {
      w.terminate()
      worker.current = null
    }
  }, [setItems])

  const add = (files: File[]) => {
    const added = files.map((file) => ({ id: nextId++, file }))
    const [first] = added
    if (!first) return
    for (const it of added) if (worker.current) send(worker.current, it)
    setItems((list) => [...list, ...added])
    setSelectedId(first.id)
  }

  const clear = () => {
    setItems([])
    setSelectedId(null)
  }

  const done = items.filter((it) => it.output)
  const downloadAll = () => {
    if (done.length === 1 && done[0]?.output) return downloadBlob(done[0].output, cleanName(done[0].file.name))
    // Same-named files would overwrite each other in the zip
    const used = new Set<string>()
    const files: Record<string, Uint8Array> = {}
    for (const it of done) {
      let name = cleanName(it.file.name)
      for (let i = 2; used.has(name); i++)
        name = cleanName(it.file.name.replace(/(\.[^./]+)?$/, (ext) => `-${i}${ext}`))
      used.add(name)
      if (it.output) files[name] = it.output
    }
    downloadBlob(zipSync(files, { level: 0 }), 'clean-files.zip', 'application/zip')
  }

  const selected = items.find((it) => it.id === selectedId) ?? items[0]
  const pending = items.length - done.length - items.filter((it) => it.error).length

  if (!selected)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          multiple
          accept={ACCEPT}
          onFiles={add}
          hint='JPEG, PNG, WebP, HEIC, TIFF, PDF, DOCX, XLSX, PPTX. Files are processed on your device and never uploaded.'
        >
          Drop files here or click to browse
        </DropZone>
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
              accept={ACCEPT}
              onFileSelected={(e) => add(Array.from(e.target.files ?? []))}
            >
              <FilePlus /> Add files
            </FileButton>
            <Button size='sm' variant='ghost' onClick={clear}>
              <Trash2 /> Clear
            </Button>
            <Button size='sm' onClick={downloadAll} disabled={!done.length}>
              <Download /> {done.length > 1 ? `Download all (${done.length}, .zip)` : 'Download clean file'}
            </Button>
            {pending > 0 && <Spinner label={`Stripping${pending > 1 ? ` (${pending} left)` : ''}…`} />}
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
                  <th className='w-28 px-2.5 text-right font-medium'>Tags</th>
                  <th className='w-20 px-2.5 text-right font-medium'>Status</th>
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
                    <td className='px-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums'>
                      {it.after && `${countTags(it.before)} → ${countTags(it.after)}`}
                    </td>
                    <td className='px-2.5 text-right'>
                      {it.error ? (
                        <Badge variant='destructive'>Error</Badge>
                      ) : it.output ? (
                        it.before?.location ? (
                          <Badge variant='warning' title='The original had a GPS location; the clean file does not'>
                            <MapPin /> GPS
                          </Badge>
                        ) : (
                          <Badge variant='success'>Clean</Badge>
                        )
                      ) : (
                        <Spinner />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Details item={selected} view={view} setView={setView} />
        </Split>
      </Workspace>
    </DropTarget>
  )
}

const send = (w: Worker, { id, file }: { id: number; file: File }) =>
  file.arrayBuffer().then((buf) => {
    const data = new Uint8Array(buf)
    w.postMessage({ id, name: file.name, data } satisfies MetadataRequest, [buf])
  })

function Details({
  item,
  view,
  setView,
}: {
  item: Item
  view: 'before' | 'after'
  setView: (v: 'before' | 'after') => void
}) {
  const meta = item[view]
  return (
    <Panel
      title='Metadata'
      actions={
        <>
          <span className='max-w-48 truncate px-1.5 text-xs text-muted-foreground'>{item.file.name}</span>
          <Segmented
            label='Show metadata of'
            value={view}
            onChange={setView}
            options={[
              ['before', 'Original'],
              ['after', 'Cleaned'],
            ]}
          />
          {item.output && (
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label='Download clean file'
              title='Download clean file'
              onClick={() => item.output && downloadBlob(item.output, cleanName(item.file.name))}
            >
              <Download />
            </Button>
          )}
        </>
      }
    >
      <Alert>{item.error}</Alert>
      {!meta && !item.error && (
        <div className='p-2.5'>
          <Spinner label='Reading metadata…' />
        </div>
      )}
      {view === 'before' && meta?.location && (
        <div className='border-b px-2.5 py-1.5 text-[13px] font-medium text-warning'>
          This file reveals where it was made: {meta.location}
        </div>
      )}
      {view === 'after' && meta && (
        <div className='border-b px-2.5 py-1.5 text-[13px] text-success'>
          {countTags(item.before) - countTags(meta)} tags removed. The content itself is unchanged
          {item.file.type.startsWith('image/') && '; orientation and colour profile are kept'}.
        </div>
      )}
      {meta?.groups.map((g) => (
        <section key={g.name}>
          <h3
            className={cn(
              'sticky top-0 border-b bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground',
              g.name === 'GPS' && 'text-warning',
            )}
          >
            {g.name} <span className='font-normal'>({g.tags.length})</span>
          </h3>
          <dl className='text-[13px]'>
            {g.tags.map(([sub, tag, value], i) => (
              <div key={i} className='flex min-h-7 items-baseline gap-2 border-b py-1 pr-1 pl-2.5'>
                <dt
                  className='w-40 shrink-0 truncate text-xs text-muted-foreground'
                  title={sub ? `${sub}:${tag}` : tag}
                >
                  {tag}
                </dt>
                <dd className='min-w-0 flex-1 break-words'>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Panel>
  )
}
