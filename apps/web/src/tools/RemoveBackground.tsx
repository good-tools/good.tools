import { filesize } from 'filesize'
import { Download, ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { cn, downloadBlob } from '@/lib/utils'
import type { RemoveBgRequest, RemoveBgResponse } from '@/workers/remove-background.worker'

interface Item {
  id: number
  name: string
  file: File
  url: string
  result?: { blob: Blob; url: string; width: number; height: number }
  error?: string
}

type Background = 'transparent' | 'white' | 'custom'

const checkerboard = 'repeating-conic-gradient(var(--border) 0 25%, var(--background) 0 50%) 0 0 / 16px 16px'

/** The cut-out PNG on a solid colour */
async function flatten(blob: Blob, color: string): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode PNG'))), 'image/png'),
  )
}

let nextId = 0

export default function RemoveBackground() {
  const [items, setItems] = useToolState<Item[]>('removebg:items', [])
  const [selectedId, setSelectedId] = useToolState<number | null>('removebg:selected', null)
  const [background, setBackground] = useToolState<Background>('removebg:background', 'transparent')
  const [color, setColor] = useToolState('removebg:color', '#22c55e')
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [backend, setBackend] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const worker = useRef<Worker | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const send = (item: Item) => worker.current?.postMessage({ id: item.id, file: item.file } satisfies RemoveBgRequest)

  useEffect(() => {
    const w = new Worker(new URL('../workers/remove-background.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onerror = (e) => setError(`Background removal worker failed to load: ${e.message}`)
    w.onmessage = ({ data: msg }: MessageEvent<RemoveBgResponse>) => {
      if (msg.type === 'progress') setProgress(msg)
      else if (msg.type === 'ready') setBackend(msg.backend)
      else if (msg.type === 'error' && msg.id === undefined) setError(msg.error)
      else
        setItems((list) =>
          list.map((it) =>
            it.id !== msg.id
              ? it
              : msg.type === 'done'
                ? { ...it, result: { ...msg, url: URL.createObjectURL(msg.blob) } }
                : { ...it, error: msg.error },
          ),
        )
    }
    // Images still waiting when the tool was left are sent again
    for (const it of itemsRef.current) if (!it.result && !it.error) w.postMessage({ id: it.id, file: it.file })
    return () => {
      w.terminate()
      worker.current = null
    }
  }, [setItems])

  const add = (files: File[]) => {
    const images = files.filter((f) => !f.type || f.type.startsWith('image/'))
    if (images.length < files.length) setError('Some files were skipped because they are not images')
    const added = images.map((file) => ({ id: nextId++, name: file.name, file, url: URL.createObjectURL(file) }))
    const [first] = added
    if (!first) return
    for (const it of added) send(it)
    setItems((list) => [...list, ...added])
    setSelectedId(first.id)
  }

  const clear = () => {
    for (const it of items) {
      URL.revokeObjectURL(it.url)
      if (it.result) URL.revokeObjectURL(it.result.url)
    }
    setItems([])
    setSelectedId(null)
    setError(null)
  }

  const fill = background === 'white' ? '#ffffff' : background === 'custom' ? color : null

  const download = async (it: Item) => {
    if (!it.result) return
    try {
      const blob = fill ? await flatten(it.result.blob, fill) : it.result.blob
      downloadBlob(blob, `${it.name.replace(/\.[^/.]+$/, '')}-no-bg.png`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const loading = !backend && !error && (
    <Spinner
      label={
        !progress
          ? 'Loading model…'
          : progress.total
            ? `Downloading model… ${Math.round((progress.loaded / progress.total) * 100)}%`
            : `Downloading model… ${filesize(progress.loaded, { base: 2 })}`
      }
    />
  )

  const selected = items.find((it) => it.id === selectedId) ?? items[0]
  const done = items.filter((it) => it.result)
  const pending = items.length - done.length - items.filter((it) => it.error).length

  if (!selected)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          multiple
          accept='image/*'
          onFiles={add}
          hint='JPEG, PNG, WebP, GIF, AVIF. The AI model runs on your device; images are never uploaded.'
        >
          Drop images here or click to browse
        </DropZone>
        {loading}
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <DropTarget onFiles={add} label='Drop to add images'>
      <Workspace
        toolbar={
          <>
            <FileButton
              size='sm'
              variant='ghost'
              accept='image/*'
              multiple
              onFileSelected={(e) => add(Array.from(e.target.files ?? []))}
            >
              <ImagePlus /> Add images
            </FileButton>
            <Segmented<Background>
              label='Background'
              value={background}
              onChange={setBackground}
              options={[
                ['transparent', 'Transparent'],
                ['white', 'White'],
                ['custom', 'Colour'],
              ]}
            />
            {background === 'custom' && (
              <input
                type='color'
                aria-label='Background colour'
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className='h-7 w-9 cursor-pointer rounded-md border bg-background p-0.5'
              />
            )}
            <Button size='sm' onClick={() => download(selected)} disabled={!selected.result}>
              <Download /> Download PNG
            </Button>
            {items.length > 1 && (
              <Button
                size='sm'
                variant='outline'
                onClick={async () => {
                  for (const it of done) await download(it)
                }}
                disabled={!done.length}
              >
                <Download /> Download all ({done.length})
              </Button>
            )}
            <Button size='sm' variant='ghost' onClick={clear}>
              <Trash2 /> Clear
            </Button>
            {loading ||
              (pending > 0 && <Spinner label={`Removing background${pending > 1 ? ` (${pending} left)` : ''}…`} />)}
            {backend && <span className='ml-auto text-xs text-muted-foreground'>Running on {backend}</span>}
          </>
        }
      >
        <Alert>{error}</Alert>
        {items.length > 1 && (
          <div className='flex shrink-0 gap-1.5 overflow-x-auto'>
            {items.map((it) => (
              <button
                key={it.id}
                type='button'
                title={it.name}
                aria-label={`Show ${it.name}`}
                aria-pressed={it.id === selected.id}
                onClick={() => setSelectedId(it.id)}
                className={cn(
                  'size-14 shrink-0 overflow-hidden rounded-md border',
                  it.id === selected.id && 'ring-2 ring-ring',
                  it.error && 'border-destructive',
                )}
                style={{ background: checkerboard }}
              >
                <img src={it.result?.url ?? it.url} alt='' className='size-full object-contain' />
              </button>
            ))}
          </div>
        )}
        <Alert>{selected.error}</Alert>
        <Split>
          <Panel
            title='Original'
            actions={<span className='max-w-60 truncate px-1.5 text-xs text-muted-foreground'>{selected.name}</span>}
          >
            <div className='flex h-full items-center justify-center bg-muted/30 p-2'>
              <img src={selected.url} alt='Original' className='max-h-full max-w-full object-contain' />
            </div>
          </Panel>
          <Panel
            title='Result'
            actions={
              selected.result && (
                <span className='px-1.5 text-xs text-muted-foreground'>
                  {selected.result.width}×{selected.result.height}
                </span>
              )
            }
          >
            <div className='flex h-full items-center justify-center p-2'>
              {selected.result ? (
                <img
                  src={selected.result.url}
                  alt='Background removed'
                  className='max-h-full max-w-full object-contain'
                  style={{ background: fill ?? checkerboard }}
                />
              ) : (
                !selected.error && <Spinner label='Removing background…' />
              )}
            </div>
          </Panel>
        </Split>
      </Workspace>
    </DropTarget>
  )
}
