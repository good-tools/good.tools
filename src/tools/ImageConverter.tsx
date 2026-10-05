import { filesize } from 'filesize'
import { Download, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/ui/drop-zone'
import { fieldClass, Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { cn, downloadBlob } from '@/lib/utils'
import type { ImageInfo, OutputFormat, VipsRequest, VipsWorkerResponse } from '@/workers/vips.worker'

type ResizeMode = 'none' | 'percentage' | 'width' | 'height' | 'dimensions'

interface Source {
  name: string
  buffer: ArrayBuffer
  type: string
}

interface Result {
  buffer: ArrayBuffer
  format: OutputFormat
}

const mimeOf = (format: OutputFormat) => `image/${format}`

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

function Preview({ title, url, footer }: { title: string; url?: string; footer: React.ReactNode }) {
  return (
    <Panel title={title} actions={<span className='px-1.5 text-xs text-muted-foreground'>{footer}</span>}>
      <div className='flex h-full items-center justify-center bg-muted/30 p-2'>
        {url ? (
          <img src={url} alt={title} className='max-h-full max-w-full object-contain' />
        ) : (
          <span className='text-xs text-muted-foreground'>Convert to see the result</span>
        )}
      </div>
    </Panel>
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

  const workerRef = useRef<Worker | null>(null)
  // Replies carry the request id; anything but the latest request is stale and dropped
  const requestId = useRef(0)

  const originalUrl = useObjectUrl(source?.buffer, source?.type ?? '')
  const resultUrl = useObjectUrl(result?.buffer, result ? mimeOf(result.format) : '')

  useEffect(() => {
    const worker = new Worker(new URL('../workers/vips.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
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
          setFormat(msg.data.hasAlpha ? 'png' : 'webp')
        } else if (msg.type === 'converted') setResult({ buffer: msg.data, format: msg.format })
      }
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [setFormat, setInfo, setResult])

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
      if (!file.type.startsWith('image/')) return setError(`${file.name} is not an image`)
      const buffer = await file.arrayBuffer()
      setSource({ name: file.name, buffer, type: file.type })
      setInfo(null)
      setResult(null)
      send({ type: 'load', buffer })
    },
    [setInfo, setResult, setSource, send],
  )

  const size = info && outputSize(info, resizeMode, percentage, width, height)

  const convert = () => {
    if (!source || !size) return
    send({
      type: 'convert',
      buffer: source.buffer,
      format,
      options: { quality, resize: resizeMode === 'none' ? undefined : size },
    })
  }

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
          hint='JPEG, PNG, WebP, GIF, TIFF, AVIF — converted locally with libvips'
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
          <Button size='sm' onClick={convert} disabled={busy || !info}>
            <RefreshCw /> Convert
          </Button>
          <select
            aria-label='Output format'
            className={selectClass}
            value={format}
            onChange={(e) => setFormat(e.target.value as OutputFormat)}
          >
            <option value='webp'>WebP</option>
            <option value='jpeg'>JPEG</option>
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
          {result && (
            <Button
              size='sm'
              variant='outline'
              onClick={() =>
                downloadBlob(
                  result.buffer,
                  `${source.name.replace(/\.[^/.]+$/, '')}.${result.format}`,
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
      <Split>
        <Preview
          title={info ? `Original · ${info.width}×${info.height}` : 'Original'}
          url={originalUrl}
          footer={
            <span className='flex min-w-0 items-center gap-2'>
              <span className='max-w-48 truncate' title={source.name}>
                {source.name}
              </span>
              {filesize(source.buffer.byteLength, { base: 2 })}
            </span>
          }
        />
        <Preview
          title={result ? `Converted · ${result.format.toUpperCase()}` : 'Converted'}
          url={resultUrl}
          footer={
            result && (
              <>
                {filesize(result.buffer.byteLength, { base: 2 })}{' '}
                <span className={change < 0 ? 'text-success' : 'text-destructive'}>
                  ({change < 0 ? '' : '+'}
                  {change.toFixed(1)}%)
                </span>
              </>
            )
          }
        />
      </Split>
    </Workspace>
  )
}

export default ImageConverter
