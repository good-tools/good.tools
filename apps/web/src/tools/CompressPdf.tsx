import { filesize } from 'filesize'
import { Download, FileText, Minimize2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { PRESETS, type Preset, savedPercent } from '@/lib/compress-pdf'
import { renamePdf } from '@/lib/pdf'
import { downloadBlob } from '@/lib/utils'
import type { CompressRequest, CompressResponse } from '@/workers/compress-pdf.worker'

interface Source {
  name: string
  bytes: Uint8Array
}

const size = (n: number) => filesize(n, { base: 2 })

function CompressPdf() {
  const [preset, setPreset] = useToolState<Preset>('compress-pdf:preset', 'balanced')
  const [source, setSource] = useToolState<Source | null>('compress-pdf:source', null)
  const [result, setResult] = useState<{
    preset: Preset
    bytes: Uint8Array
    images: number
    recompressed: number
  } | null>(null)
  /** Progress text while a run is in flight; '' when idle */
  const [status, setStatus] = useState('')
  const busy = status !== ''
  const [error, setError] = useState('')
  const worker = useRef<Worker | null>(null)
  const jobId = useRef(0)

  useEffect(() => () => worker.current?.terminate(), [])

  const reset = () => {
    jobId.current++ // ignore a run still in flight
    setResult(null)
    setError('')
    setStatus('')
  }

  const load = async ([file]: File[]) => {
    if (!file) return
    reset()
    if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) return setError(`${file.name} is not a PDF`)
    setSource({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
  }

  const compress = () => {
    if (!source) return
    reset()
    setStatus('Starting...')
    // Created on first use, so the image codec only downloads when someone compresses
    worker.current ??= new Worker(new URL('../workers/compress-pdf.worker.ts', import.meta.url), { type: 'module' })
    const id = jobId.current
    worker.current.onmessage = ({ data: msg }: MessageEvent<CompressResponse>) => {
      if (msg.id !== id) return
      if (msg.type === 'status') return setStatus(msg.status)
      setStatus('')
      if (msg.type === 'error') setError(msg.error)
      else setResult({ preset, bytes: msg.bytes, images: msg.images, recompressed: msg.recompressed })
    }
    worker.current.onerror = (e) => {
      setStatus('')
      setError(`The compressor failed to load: ${e.message}`)
    }
    worker.current.postMessage({ id, bytes: source.bytes.slice(), preset } satisfies CompressRequest)
  }

  const before = source?.bytes.byteLength ?? 0
  const after = result?.bytes.byteLength ?? 0
  const saved = savedPercent(before, after)
  const grew = result && after >= before

  return (
    <DropTarget onFiles={(f) => void load(f)} label='Drop to replace the PDF'>
      <Workspace
        toolbar={
          <>
            <Segmented<Preset>
              label='Compression'
              value={preset}
              onChange={(p) => {
                setPreset(p)
                setResult(null)
              }}
              options={Object.entries(PRESETS).map(([k, v]) => [k as Preset, v.label])}
            />
            <Button size='sm' onClick={compress} disabled={!source || busy}>
              <Minimize2 /> Compress
            </Button>
            {source && (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => {
                  reset()
                  setSource(null)
                }}
              >
                <Trash2 /> Clear
              </Button>
            )}
            {busy && (
              <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                <Spinner /> {status}
              </span>
            )}
            <span className='text-xs text-muted-foreground'>{PRESETS[preset].hint}</span>
          </>
        }
      >
        {source ? (
          <div className='flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px]'>
            <FileText className='size-4 shrink-0 text-muted-foreground' />
            <span className='min-w-0 truncate'>{source.name}</span>
            <span className='text-xs text-muted-foreground'>{size(before)}</span>
          </div>
        ) : (
          <DropZone
            className='py-5'
            accept='application/pdf,.pdf'
            onFiles={(f) => void load(f)}
            hint='Stays in your browser'
          >
            Drop a PDF here or click to browse
          </DropZone>
        )}
        <Alert>{error}</Alert>
        {source && result && (
          <div className='flex flex-col gap-2'>
            <dl className='grid max-w-sm grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]'>
              <dt className='text-muted-foreground'>Original</dt>
              <dd>{size(before)}</dd>
              <dt className='text-muted-foreground'>Compressed ({PRESETS[result.preset].label})</dt>
              <dd>{size(after)}</dd>
              <dt className='text-muted-foreground'>{after > before ? 'Grew by' : 'Saved'}</dt>
              <dd className={grew ? 'text-destructive' : 'text-success'}>{grew ? -saved : saved}%</dd>
              <dt className='text-muted-foreground'>Images recompressed</dt>
              <dd>
                {result.recompressed} of {result.images}
              </dd>
            </dl>
            <Alert variant='warning'>
              {grew &&
                `The result isn't smaller than the original, which is already well optimised. Keep the original${result.preset === 'smallest' ? '' : ', or try Smallest'}.`}
            </Alert>
            <div className='flex gap-1.5'>
              <Button
                size='sm'
                variant={grew ? 'outline' : 'default'}
                onClick={() => downloadBlob(result.bytes, renamePdf(source.name, 'compressed'), 'application/pdf')}
              >
                <Download /> Download compressed
              </Button>
              {grew && (
                <Button size='sm' onClick={() => downloadBlob(source.bytes, source.name, 'application/pdf')}>
                  <Download /> Keep original
                </Button>
              )}
            </div>
          </div>
        )}
      </Workspace>
    </DropTarget>
  )
}

export default CompressPdf
