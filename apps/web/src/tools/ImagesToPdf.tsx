import { filesize } from 'filesize'
import { Download, Plus, Redo2, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { SortableList } from '@/components/ui/sortable-list'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  COMPRESSION,
  type Compression,
  imagesToPdf,
  type LayoutOptions,
  layoutPages,
  mm,
  moveRect,
  type PageLayout,
  type PageSize,
  type PdfImage,
  type Rect,
  resizeRect,
  targetPixels,
} from '@/lib/pdf'
import { cn, downloadBlob } from '@/lib/utils'

interface Item extends PdfImage {
  id: string
  name: string
  file: File
  /** Clockwise degrees */
  rotation: number
  url: string
}

/** Draws onto a fresh canvas of the given size and encodes it. JPEG gets a white background (no alpha). */
async function encode(
  width: number,
  height: number,
  format: PdfImage['format'],
  quality: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Promise<Blob> {
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  if (format === 'jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingQuality = 'high'
  draw(ctx)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), `image/${format}`, quality),
  )
}

/**
 * Decodes and re-encodes through a canvas so the PDF gets what the user sees: EXIF orientation applied
 * (phone photos), plus the user's rotation. PNG stays lossless; everything else becomes JPEG.
 */
async function prepare(file: File, rotation: number, id: string = crypto.randomUUID()): Promise<Item> {
  const bitmap = await createImageBitmap(file)
  const turned = rotation % 180 !== 0
  const width = turned ? bitmap.height : bitmap.width
  const height = turned ? bitmap.width : bitmap.height
  const format = file.type === 'image/png' ? 'png' : 'jpeg'
  const blob = await encode(width, height, format, 0.92, (ctx) => {
    ctx.translate(width / 2, height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  })
  bitmap.close()
  return {
    id,
    name: file.name,
    file,
    rotation,
    format,
    width,
    height,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    url: URL.createObjectURL(blob),
  }
}

/** Downsamples to what `rect` needs at the preset's dpi and re-encodes as JPEG, unless that isn't smaller. */
async function compress(item: Item, rect: Rect, compression: Compression): Promise<PdfImage> {
  if (compression === 'none') return item
  const { dpi, quality } = COMPRESSION[compression]
  const t = targetPixels(item, rect, dpi)
  const bitmap = await createImageBitmap(new Blob([item.bytes as BlobPart]))
  const blob = await encode(t.width, t.height, 'jpeg', quality, (ctx) => ctx.drawImage(bitmap, 0, 0, t.width, t.height))
  bitmap.close()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return bytes.byteLength < item.bytes.byteLength ? { ...t, format: 'jpeg', bytes } : item
}

async function buildPdf(images: Item[], pages: PageLayout[], compression: Compression) {
  const rects = new Map(pages.flatMap((p) => p.items.map((it) => [it.index, it] as const)))
  const out = await Promise.all(
    images.map((img, i) => {
      const rect = rects.get(i)
      return rect ? compress(img, rect, compression) : img
    }),
  )
  return imagesToPdf(out, pages)
}

/** One preview page; images can be dragged, resized from the corner, or moved with the keyboard. */
function PagePreview({
  page,
  number,
  images,
  onPlace,
  onBegin,
  onRotate,
}: {
  page: PageLayout
  number: number
  images: Item[]
  onPlace: (id: string, rect: Rect) => void
  /** Called once before each user edit (one drag = one edit), for undo */
  onBegin: () => void
  onRotate: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const drag = (e: React.PointerEvent<HTMLElement>, id: string, start: Rect, mode: 'move' | 'resize') => {
    if (e.button !== 0 || !ref.current) return
    e.preventDefault()
    e.stopPropagation()
    const ptPerPx = page.width / ref.current.getBoundingClientRect().width
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    let moved = false // a plain click is not an edit
    const move = (ev: PointerEvent) => {
      if (!moved) onBegin()
      moved = true
      const dx = (ev.clientX - e.clientX) * ptPerPx
      const dy = (ev.clientY - e.clientY) * ptPerPx
      onPlace(id, mode === 'move' ? moveRect(start, dx, dy, page) : resizeRect(start, dx, page))
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  const keys = (e: React.KeyboardEvent, id: string, r: Rect) => {
    const step = mm(e.shiftKey ? 10 : 1)
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const m = moves[e.key]
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'r' || e.key === 'R') onRotate(id)
    else if (m) {
      onBegin()
      onPlace(id, moveRect(r, m[0], m[1], page))
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      onBegin()
      onPlace(id, resizeRect(r, e.key === '-' ? -step : step, page))
    } else return
    e.preventDefault()
  }

  return (
    <div
      ref={ref}
      role='group'
      aria-label={`Page ${number}`}
      className='relative w-full max-w-md touch-none border bg-white shadow-sm select-none'
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
    >
      {page.items.map(({ index, ...rect }) => {
        const img = images[index]
        if (!img) return null
        return (
          <button
            key={img.id}
            type='button'
            aria-label={`${img.name}: drag or use arrow keys to move (Shift for 10 mm), + and - to resize, R to rotate`}
            title='Drag to move, drag the corner to resize'
            className='group absolute cursor-move outline-offset-1 hover:outline hover:outline-foreground/40 focus-visible:outline-2 focus-visible:outline-foreground'
            style={{
              left: `${(rect.x / page.width) * 100}%`,
              top: `${((page.height - rect.y - rect.height) / page.height) * 100}%`,
              width: `${(rect.width / page.width) * 100}%`,
              height: `${(rect.height / page.height) * 100}%`,
            }}
            onPointerDown={(e) => drag(e, img.id, rect, 'move')}
            onKeyDown={(e) => keys(e, img.id, rect)}
          >
            <img src={img.url} alt='' draggable={false} className='size-full' />
            <span
              aria-hidden
              className='absolute -right-1 -bottom-1 hidden size-2.5 cursor-nwse-resize border border-white bg-foreground group-hover:block group-focus-visible:block'
              onPointerDown={(e) => drag(e, img.id, rect, 'resize')}
            />
          </button>
        )
      })}
    </div>
  )
}

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')
const inlineLabel = 'flex items-center gap-1.5 text-xs text-muted-foreground'

function ImagesToPdf() {
  const [images, setImages] = useToolState<Item[]>('images-pdf:images', [])
  const [pageSize, setPageSize] = useToolState<PageSize>('images-pdf:pageSize', 'a4')
  const [landscape, setLandscape] = useToolState('images-pdf:landscape', false)
  const [perPage, setPerPage] = useToolState('images-pdf:perPage', 1)
  const [size, setSize] = useToolState<LayoutOptions['size']>('images-pdf:size', 'fit')
  const [marginMm, setMarginMm] = useToolState('images-pdf:margin', 10)
  const [compression, setCompression] = useToolState<Compression>('images-pdf:compression', 'high')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Hand-placed images, by image id. Only valid for the layout options they were placed under.
  const [placed, setPlaced] = useToolState<{ key: string; rects: Record<string, Rect> }>('images-pdf:placed', {
    key: '',
    rects: {},
  })

  const options: LayoutOptions = { pageSize, landscape, perPage, size, margin: mm(marginMm) }
  const key = JSON.stringify(options)
  const rects = placed.key === key ? placed.rects : {}
  const pages = layoutPages(images, options).map((page) => ({
    ...page,
    items: page.items.map((it) => ({ ...it, ...rects[images[it.index]?.id ?? ''] })),
  }))
  const place = (id: string, rect: Rect) => setPlaced({ key, rects: { ...rects, [id]: rect } })

  // Undo history of the images and their placement (layout options are plain controls, not history)
  type Snapshot = { images: Item[]; placed: typeof placed }
  const [past, setPast] = useToolState<Snapshot[]>('images-pdf:past', [])
  const [future, setFuture] = useToolState<Snapshot[]>('images-pdf:future', [])
  /** Call right before an edit. */
  const record = () => {
    setPast((p) => [...p.slice(-49), { images, placed }])
    setFuture([])
  }
  const travel = (from: Snapshot[], setFrom: typeof setPast, setTo: typeof setPast) => {
    const s = from.at(-1)
    if (!s) return
    setFrom(from.slice(0, -1))
    setTo((t) => [...t, { images, placed }])
    setImages(s.images)
    setPlaced(s.placed)
  }
  const undo = () => travel(past, setPast, setFuture)
  const redo = () => travel(future, setFuture, setPast)

  // Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y; fields keep their own text undo
  const shortcuts = useRef({ undo, redo })
  shortcuts.current = { undo, redo }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) shortcuts.current.undo()
      else if ((k === 'z' && e.shiftKey) || k === 'y') shortcuts.current.redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Preview URLs stay alive while any history step can show them
  const known = useRef(new Set<string>())
  useEffect(() => {
    const live = new Set(
      [images, ...past.map((s) => s.images), ...future.map((s) => s.images)].flat().map((i) => i.url),
    )
    for (const url of known.current) if (!live.has(url)) URL.revokeObjectURL(url)
    known.current = live
  }, [images, past, future])

  // The PDF is built in the background whenever its inputs settle, so its real size can be shown
  // and Download is instant. Keyed by content: `pages` is a new array on every render.
  const buildKey = JSON.stringify([images.map((i) => i.url), pages, compression])
  const [output, setOutput] = useState<{ key: string; bytes: Uint8Array } | null>(null)
  const current = output?.key === buildKey ? output.bytes : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: buildKey captures images, pages and compression
  useEffect(() => {
    if (!images.length) return
    let live = true
    const timer = setTimeout(() => {
      buildPdf(images, pages, compression).then(
        (bytes) => live && setOutput({ key: buildKey, bytes }),
        (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
      )
    }, 300)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [buildKey])

  const update = (next: Item[]) => {
    record()
    setImages(next)
  }

  const add = async (files: File[]) => {
    setError('')
    setBusy(true)
    const results = await Promise.allSettled(files.map((f) => prepare(f, 0)))
    const added = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failed = files.filter((_, i) => results[i]?.status === 'rejected').map((f) => f.name)
    if (failed.length) setError(`Could not read ${failed.join(', ')}. Use JPEG, PNG, WebP or GIF.`)
    if (added.length) record()
    setImages((prev) => [...prev, ...added])
    setBusy(false)
  }

  const rotate = async (item: Item) => {
    const turned = await prepare(item.file, (item.rotation + 90) % 360, item.id)
    record()
    setImages(images.map((i) => (i.id === item.id ? turned : i)))
    // Its hand-placed box has the old aspect ratio
    const { [item.id]: _, ...rest } = rects
    setPlaced({ key, rects: rest })
  }

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      downloadBlob(current ?? (await buildPdf(images, pages, compression)), 'images.pdf', 'application/pdf')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  if (!images.length)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          multiple
          accept='image/*'
          onFiles={(f) => void add(f)}
          hint='e.g. the front and back of an ID card, on one page. Nothing is uploaded.'
        >
          Drop images here or click to browse
        </DropZone>
        {busy && <Spinner />}
        {past.length > 0 && (
          <Button size='sm' variant='outline' className='self-start' onClick={undo}>
            <Undo2 /> Undo
          </Button>
        )}
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <DropTarget onFiles={(f) => void add(f)} label='Drop to add images'>
      <Workspace
        toolbar={
          <>
            <Button size='sm' onClick={() => void download()} disabled={busy}>
              <Download /> Download PDF
            </Button>
            <span className='w-20 font-mono text-xs text-muted-foreground' aria-live='polite' title='Size of the PDF'>
              {current ? filesize(current.byteLength, { base: 2 }) : 'sizing…'}
            </span>
            <FileButton
              size='sm'
              accept='image/*'
              multiple
              onFileSelected={(e) => void add(Array.from(e.target.files ?? []))}
            >
              <Plus /> Add images
            </FileButton>
            <select
              aria-label='Page size'
              className={selectClass}
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
            >
              <option value='a4'>A4</option>
              <option value='letter'>Letter</option>
              <option value='legal'>Legal</option>
              <option value='a5'>A5</option>
              <option value='fit'>Page = image size</option>
            </select>
            {pageSize !== 'fit' && (
              <>
                <Segmented
                  label='Orientation'
                  value={landscape ? 'landscape' : 'portrait'}
                  onChange={(v) => setLandscape(v === 'landscape')}
                  options={[
                    ['portrait', 'Portrait'],
                    ['landscape', 'Landscape'],
                  ]}
                />
                <select
                  aria-label='Images per page'
                  className={selectClass}
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                >
                  {[1, 2, 4, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </>
            )}
            <select
              aria-label='Image size'
              className={selectClass}
              value={size}
              onChange={(e) => setSize(e.target.value as LayoutOptions['size'])}
            >
              <option value='fit'>Fit to space</option>
              <option value='card'>ID card size (85.6×54 mm)</option>
            </select>
            <select
              aria-label='Compression'
              className={selectClass}
              value={compression}
              onChange={(e) => setCompression(e.target.value as Compression)}
            >
              {Object.entries(COMPRESSION).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className={inlineLabel}>
              Margin
              <Input
                type='number'
                min={0}
                max={50}
                className='h-7 w-14 text-xs'
                value={marginMm}
                onChange={(e) => setMarginMm(Math.max(0, Number(e.target.value)))}
              />
              mm
            </label>
            {Object.keys(rects).length > 0 && (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => {
                  record()
                  setPlaced({ key: '', rects: {} })
                }}
              >
                <RotateCcw /> Reset positions
              </Button>
            )}
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label='Undo'
              title='Undo (Ctrl+Z)'
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 />
            </Button>
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label='Redo'
              title='Redo (Ctrl+Shift+Z)'
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 />
            </Button>
            <Button size='sm' variant='ghost' onClick={() => update([])}>
              <Trash2 /> Clear
            </Button>
            {busy && <Spinner />}
          </>
        }
      >
        <Alert>{error}</Alert>
        <Split>
          <Panel title={`${images.length} images`}>
            <SortableList
              items={images}
              onChange={update}
              actions={(item) => (
                <Button
                  size='icon-sm'
                  variant='ghost'
                  aria-label={`Rotate ${item.name}`}
                  onClick={() => void rotate(item)}
                >
                  <RotateCw />
                </Button>
              )}
            >
              {(item) => (
                <>
                  <img src={item.url} alt='' className='size-9 shrink-0 rounded-sm border object-contain' />
                  <span className='min-w-0 truncate' title={item.name}>
                    {item.name}
                  </span>
                  <span className='shrink-0 font-mono text-xs text-muted-foreground'>
                    {item.width}×{item.height}
                  </span>
                </>
              )}
            </SortableList>
          </Panel>
          <Panel title={`Preview · ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`}>
            <div className='flex flex-col items-center gap-3 bg-muted/30 p-3'>
              {pages.map((page, n) => (
                <PagePreview
                  key={n}
                  page={page}
                  number={n + 1}
                  images={images}
                  onPlace={place}
                  onBegin={record}
                  onRotate={(id) => {
                    const item = images.find((i) => i.id === id)
                    if (item) void rotate(item)
                  }}
                />
              ))}
            </div>
          </Panel>
        </Split>
      </Workspace>
    </DropTarget>
  )
}

export default ImagesToPdf
