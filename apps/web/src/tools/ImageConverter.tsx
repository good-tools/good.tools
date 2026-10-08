import { filesize } from 'filesize'
import { Download, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropZone } from '@/components/ui/drop-zone'
import { fieldClass, Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { cn, downloadBlob } from '@/lib/utils'
import {
  HEIF_WORKER,
  type ImageInfo,
  type OutputFormat,
  type VipsRequest,
  type VipsWorkerResponse,
} from '@/workers/vips.worker'

type ResizeMode = 'none' | 'percentage' | 'width' | 'height' | 'dimensions'

interface Source {
  name: string
  buffer: ArrayBuffer
  type: string
  /** PNG decoded by the browser when vips can't read the original format */
  decoded?: ArrayBuffer
}

interface Result {
  buffer: ArrayBuffer
  format: OutputFormat
}

const mimeOf = (format: OutputFormat) => `image/${format}`
const extensionOf = (format: OutputFormat) => (format === 'jpeg' ? 'jpg' : format)

/** Object URL for `data`, revoked when the data changes or the component unmounts. */
function useObjectUrl(data: ArrayBuffer | undefined, type: string) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!data) return setUrl(undefined)
    const u = URL.createObjectURL(new Blob([data], { type }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [data, type])
  return url
}

function outputSize(info: ImageInfo, mode: ResizeMode, pct: number, w: number | '', h: number | '') {
  const { width, height } = info
  switch (mode) {
    case 'none':
      return { width, height }
    case 'percentage':
      return {
        width: Math.max(1, Math.round((width * pct) / 100)),
        height: Math.max(1, Math.round((height * pct) / 100)),
      }
    case 'width': {
      const tw = w || width
      return { width: tw, height: Math.max(1, Math.round((tw * height) / width)) }
    }
    case 'height': {
      const th = h || height
      return { width: Math.max(1, Math.round((th * width) / height)), height: th }
    }
    case 'dimensions':
      return { width: w || width, height: h || height }
  }
}

interface View {
  x: number
  y: number
  zoom: number
}

const FIT: View = { x: 0, y: 0, zoom: 1 }

/** Zoom by `factor` keeping the point (`px`, `py`) of the viewport under the cursor. Zoom stays within 1–32×. */
export function zoomAt(view: View, factor: number, px: number, py: number): View {
  const zoom = Math.min(32, Math.max(1, view.zoom * factor))
  if (zoom === 1) return FIT
  const k = zoom / view.zoom
  return { zoom, x: px - (px - view.x) * k, y: py - (py - view.y) * k }
}

/** Both images in one viewport with a draggable split; wheel zooms and dragging pans both at once. */
function Compare({ before, after, afterLabel }: { before?: string; after?: string; afterLabel: string }) {
  const [split, setSplit] = useState(50)
  const [view, setView] = useState(FIT)
  const box = useRef<HTMLDivElement>(null)

  // React's wheel listener is passive, so preventDefault (stop the page scrolling) needs a native one
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setView((v) => zoomAt(v, Math.exp(-e.deltaY / 300), e.clientX - r.left, e.clientY - r.top))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const drag = (e: React.PointerEvent, move: (dx: number, dy: number, width: number) => void) => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    let { clientX: lx, clientY: ly } = e
    const width = box.current?.clientWidth ?? 1
    el.onpointermove = (m) => {
      move(m.clientX - lx, m.clientY - ly, width)
      lx = m.clientX
      ly = m.clientY
    }
    el.onpointerup = () => {
      el.onpointermove = null
    }
  }

  const layer = (url: string | undefined, alt: string, clip?: string) => (
    <div className='absolute inset-0 overflow-hidden' style={{ clipPath: clip }}>
      {url && (
        <img
          src={url}
          alt={alt}
          draggable={false}
          className='size-full origin-top-left object-contain'
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            imageRendering: view.zoom >= 4 ? 'pixelated' : undefined,
          }}
        />
      )}
    </div>
  )
  const chip = 'pointer-events-none absolute top-2 rounded bg-background/80 px-1.5 py-0.5 text-[11px] font-medium'

  return (
    <div
      ref={box}
      role='group'
      aria-label='Before and after: scroll to zoom, drag to pan, double-click to fit'
      className='relative h-full cursor-grab touch-none overflow-hidden bg-muted/30 select-none active:cursor-grabbing'
      onPointerDown={(e) =>
        drag(e, (dx, dy) => setView((v) => (v.zoom === 1 ? v : { ...v, x: v.x + dx, y: v.y + dy })))
      }
      onDoubleClick={() => setView(FIT)}
    >
      {layer(before, 'Original')}
      {layer(after, afterLabel, `inset(0 0 0 ${split}%)`)}
      {!after && (
        <span
          className='absolute inset-y-0 right-0 flex items-center justify-center text-xs text-muted-foreground'
          style={{ left: `${split}%` }}
        >
          Converting…
        </span>
      )}
      <span className={cn(chip, 'left-2')}>Original</span>
      <span className={cn(chip, 'right-2')}>{afterLabel}</span>
      <div
        role='slider'
        tabIndex={0}
        aria-label='Comparison split'
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split)}
        className='group absolute inset-y-0 -ml-2 w-4 cursor-ew-resize focus-visible:outline-none'
        style={{ left: `${split}%` }}
        onPointerDown={(e) => {
          e.stopPropagation()
          drag(e, (dx, _, width) => setSplit((s) => Math.min(100, Math.max(0, s + (dx / width) * 100))))
        }}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowLeft' ? -2 : e.key === 'ArrowRight' ? 2 : 0
          if (step) setSplit((s) => Math.min(100, Math.max(0, s + step)))
        }}
      >
        <div className='mx-auto h-full w-px bg-foreground/70' />
        <div className='absolute top-1/2 left-1/2 h-8 w-2 -translate-1/2 rounded-full border bg-background shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-ring/50' />
      </div>
      {view.zoom > 1 && (
        <Button
          size='sm'
          variant='outline'
          className='absolute right-2 bottom-2'
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setView(FIT)}
        >
          {Math.round(view.zoom * 100)}% · Fit
        </Button>
      )}
    </div>
  )
}

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')
const inlineLabel = 'flex items-center gap-1.5 text-xs text-muted-foreground'

function ImageConverter() {
  const [source, setSource] = useToolState<Source | null>('image:source', null)
  const [info, setInfo] = useToolState<ImageInfo | null>('image:info', null)
  const [result, setResult] = useToolState<Result | null>('image:result', null)

  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Initializing...')

  const [format, setFormat] = useToolState<OutputFormat>('image:format', 'webp')
  const [quality, setQuality] = useToolState('image:quality', 80)
  const [resizeMode, setResizeMode] = useToolState<ResizeMode>('image:resizeMode', 'none')
  const [percentage, setPercentage] = useToolState('image:percentage', 50)
  const [width, setWidth] = useToolState<number | ''>('image:width', '')
  const [height, setHeight] = useToolState<number | ''>('image:height', '')
  const [keepMetadata, setKeepMetadata] = useToolState('image:keepMetadata', false)

  // AVIF needs the HEIF module (3.8 MB); switch to a worker that loads it the first time AVIF is picked
  const [heif, setHeif] = useState(format === 'avif')
  if (format === 'avif' && !heif) setHeif(true)

  const workerRef = useRef<Worker | null>(null)
  // Replies carry the request id; anything but the latest request is stale and dropped
  const requestId = useRef(0)
  // Pick a default output format only for a newly opened file, not when a worker reloads the same one
  const pickFormat = useRef(false)
  const sourceRef = useRef(source)
  sourceRef.current = source

  // Show the browser-decoded PNG when the original (e.g. HEIC) can't be displayed directly
  const originalUrl = useObjectUrl(
    source?.decoded ?? source?.buffer,
    source?.decoded ? 'image/png' : (source?.type ?? ''),
  )
  const resultUrl = useObjectUrl(result?.buffer, result ? mimeOf(result.format) : '')

  useEffect(() => {
    const worker = new Worker(new URL('../workers/vips.worker.ts', import.meta.url), {
      type: 'module',
      name: heif ? HEIF_WORKER : 'vips',
    })
    workerRef.current = worker
    setReady(false)
    worker.onerror = (e) => setError(`Image worker failed to load: ${e.message}`)
    worker.onmessage = (event: MessageEvent<VipsWorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'init') {
        setReady(true)
        setStatus('Ready')
      } else if (msg.type === 'status') {
        setStatus(msg.status)
      } else if (msg.id === undefined || msg.id === requestId.current) {
        setBusy(false)
        if (msg.type === 'error') setError(msg.error)
        else if (msg.type === 'loaded') {
          setInfo(msg.data)
          const current = sourceRef.current
          if (msg.decoded && current) setSource({ ...current, decoded: msg.decoded })
          if (pickFormat.current) setFormat(msg.data.hasAlpha ? 'png' : 'webp')
          pickFormat.current = false
        } else if (msg.type === 'converted') setResult({ buffer: msg.data, format: msg.format })
      }
    }
    // A replacement worker (switching to AVIF) gets the open file again if it was still loading
    const pending = sourceRef.current
    if (pending && !pending.decoded) {
      const buffer = pending.buffer.slice(0)
      worker.postMessage({ type: 'load', buffer, id: ++requestId.current }, [buffer])
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [heif, setFormat, setInfo, setResult, setSource])

  const send = useCallback((msg: VipsRequest) => {
    const buffer = msg.buffer.slice(0) // transferred; keep our copy intact
    setBusy(true)
    setError(null)
    workerRef.current?.postMessage({ ...msg, buffer, id: ++requestId.current }, [buffer])
  }, [])

  // The worker queues messages until wasm-vips is ready, so files dropped during init still load
  const handleFile = useCallback(
    async ([file]: File[]) => {
      if (!file) return
      // Some systems report no type for HEIC/AVIF; let the decoder decide then
      if (file.type && !file.type.startsWith('image/')) return setError(`${file.name} is not an image`)
      const buffer = await file.arrayBuffer()
      setSource({ name: file.name, buffer, type: file.type })
      setInfo(null)
      setResult(null)
      pickFormat.current = true
      send({ type: 'load', buffer })
    },
    [setInfo, setResult, setSource, send],
  )

  const size = info && outputSize(info, resizeMode, percentage, width, height)

  const outWidth = size?.width
  const outHeight = size?.height
  // Convert live as settings change; replies to superseded requests are dropped by id
  // biome-ignore lint/correctness/useExhaustiveDependencies: heif re-sends to the new worker after switching
  useEffect(() => {
    if (!source || !info || !outWidth || !outHeight) return
    const t = setTimeout(
      () =>
        send({
          type: 'convert',
          buffer: source.decoded ?? source.buffer,
          format,
          options: {
            quality,
            resize: resizeMode === 'none' ? undefined : { width: outWidth, height: outHeight },
            keepMetadata,
          },
        }),
      250,
    )
    return () => clearTimeout(t)
  }, [source, info, format, quality, resizeMode, outWidth, outHeight, keepMetadata, send, heif])

  const clear = () => {
    requestId.current++
    setSource(null)
    setInfo(null)
    setResult(null)
    setError(null)
    setBusy(false)
    setResizeMode('none')
    setWidth('')
    setHeight('')
  }

  const change =
    result && source ? ((result.buffer.byteLength - source.buffer.byteLength) / source.buffer.byteLength) * 100 : 0

  if (!source)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          onFiles={(f) => void handleFile(f)}
          accept='image/*'
          hint='JPEG, PNG, WebP, GIF, TIFF, AVIF, HEIC (if your browser opens it). Converted on your device; nothing is uploaded.'
        >
          Drop an image here or click to browse
        </DropZone>
        {!ready && <Spinner label={status} />}
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <Workspace
      toolbar={
        <>
          <select
            aria-label='Output format'
            className={selectClass}
            value={format}
            onChange={(e) => setFormat(e.target.value as OutputFormat)}
          >
            <option value='webp'>WebP</option>
            <option value='jpeg'>JPEG</option>
            <option value='avif'>AVIF</option>
            <option value='png'>PNG (lossless)</option>
          </select>
          {format !== 'png' && (
            <label className={inlineLabel}>
              Quality
              <input
                type='range'
                min={1}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className='w-20 accent-primary'
              />
              <span className='w-6 font-mono text-foreground'>{quality}</span>
            </label>
          )}
          <select
            aria-label='Resize'
            className={selectClass}
            value={resizeMode}
            onChange={(e) => setResizeMode(e.target.value as ResizeMode)}
          >
            <option value='none'>Original size</option>
            <option value='percentage'>Scale %</option>
            <option value='width'>Width (keep ratio)</option>
            <option value='height'>Height (keep ratio)</option>
            <option value='dimensions'>Exact size</option>
          </select>
          {resizeMode === 'percentage' && (
            <label className={inlineLabel}>
              <span className='sr-only'>Scale</span>
              <input
                type='range'
                min={1}
                max={200}
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className='w-20 accent-primary'
              />
              <span className='w-9 font-mono text-foreground'>{percentage}%</span>
            </label>
          )}
          {(resizeMode === 'width' || resizeMode === 'dimensions') && (
            <Input
              aria-label='Width (px)'
              type='number'
              min={1}
              className='h-7 w-20 text-xs'
              placeholder={info ? `W ${info.width}` : 'Width'}
              value={width}
              onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : '')}
            />
          )}
          {(resizeMode === 'height' || resizeMode === 'dimensions') && (
            <Input
              aria-label='Height (px)'
              type='number'
              min={1}
              className='h-7 w-20 text-xs'
              placeholder={info ? `H ${info.height}` : 'Height'}
              value={height}
              onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : '')}
            />
          )}
          {resizeMode !== 'none' && size && (
            <span className='font-mono text-xs text-muted-foreground'>→ {`${size.width}×${size.height}`}</span>
          )}
          <Checkbox
            title='Keep metadata'
            description='Camera, date and GPS location. Removed unless checked.'
            checked={keepMetadata}
            onChange={(e) => setKeepMetadata(e.target.checked)}
          />
          {result && (
            <Button
              size='sm'
              variant='outline'
              onClick={() =>
                downloadBlob(
                  result.buffer,
                  `${source.name.replace(/\.[^/.]+$/, '')}.${extensionOf(result.format)}`,
                  mimeOf(result.format),
                )
              }
            >
              <Download /> Download
            </Button>
          )}
          <Button size='sm' variant='ghost' onClick={clear}>
            <Trash2 /> Clear
          </Button>
          {(!ready || busy) && <Spinner label={status} />}
        </>
      }
    >
      <Alert>{error}</Alert>
      <Panel
        title={
          <span className='flex min-w-0 items-center gap-2'>
            <span className='max-w-48 truncate normal-case' title={source.name}>
              {source.name}
            </span>
            {info && <span className='font-mono'>{`${info.width}×${info.height}`}</span>}
          </span>
        }
        actions={
          <span className='px-1.5 font-mono text-xs text-muted-foreground'>
            {filesize(source.buffer.byteLength, { base: 2 })}
            {result && (
              <>
                {' → '}
                <span className='text-foreground'>{filesize(result.buffer.byteLength, { base: 2 })}</span>{' '}
                <span className={change < 0 ? 'text-success' : 'text-destructive'}>
                  {change < 0 ? `${(-change).toFixed(1)}% smaller` : `${change.toFixed(1)}% larger`}
                </span>
              </>
            )}
          </span>
        }
        className='flex-1'
      >
        <Compare
          before={originalUrl}
          after={resultUrl}
          afterLabel={result ? result.format.toUpperCase() : format.toUpperCase()}
        />
      </Panel>
    </Workspace>
  )
}

export default ImageConverter
