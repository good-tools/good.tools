import wasmGz from '@ffmpeg/core-mt/wasm?gzip'
import workerURL from '@ffmpeg/core-mt/worker?url'
import coreURL from '@ffmpeg/core-mt?url'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { filesize } from 'filesize'
import { Download, Play, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/ui/drop-zone'
import { fieldClass, Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { AUDIO_ONLY, buildArgs, canCopy, type MediaFormat, type MediaQuality, MIME, parseTime } from '@/lib/media'
import { cn, downloadBlob, fetchInflated } from '@/lib/utils'

interface Result {
  data: Uint8Array
  format: MediaFormat
}

// The 32 MB core is shipped gzipped (~10 MB); inflate it once per page load and reuse it after a cancel
let wasmURL: Promise<string> | undefined
function loadWasm() {
  wasmURL ??= fetchInflated(wasmGz)
    .then((buf) => URL.createObjectURL(new Blob([buf], { type: 'application/wasm' })))
    .catch((e) => {
      wasmURL = undefined // retry on the next load
      throw e
    })
  return wasmURL
}

/** Object URL for `data`, revoked when the data changes or the component unmounts. */
function useObjectUrl(data: Blob | Uint8Array | undefined, type: string) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!data) return setUrl(undefined)
    const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data as BlobPart], { type }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [data, type])
  return url
}

function Player({ url, type, label }: { url?: string; type: string; label: string }) {
  if (!url) return null
  if (type.startsWith('image/')) return <img src={url} alt={label} className='max-h-full max-w-full object-contain' />
  if (type.startsWith('audio/'))
    // biome-ignore lint/a11y/useMediaCaption: user's own file, no captions available
    return <audio src={url} controls aria-label={label} className='w-full max-w-md' />
  // biome-ignore lint/a11y/useMediaCaption: user's own file, no captions available
  return <video src={url} controls aria-label={label} className='max-h-full max-w-full' />
}

const durationRE = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/
const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')
const inlineLabel = 'flex items-center gap-1.5 text-xs text-muted-foreground'

function MediaConverter() {
  const [file, setFile] = useToolState<File | null>('media:file', null)
  const [result, setResult] = useToolState<Result | null>('media:result', null)
  const [format, setFormat] = useToolState<MediaFormat>('media:format', 'mp4')
  const [quality, setQuality] = useToolState<MediaQuality>('media:quality', 'medium')
  const [height, setHeight] = useToolState('media:height', 0)
  const [start, setStart] = useToolState('media:start', '')
  const [end, setEnd] = useToolState('media:end', '')
  const [log, setLog] = useToolState('media:log', '')

  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null)
  const [generation, setGeneration] = useState(0)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lines = useRef<string[]>([])
  const total = useRef(0)
  const ffmpegRef = useRef(ffmpeg)
  ffmpegRef.current = ffmpeg

  // (Re)start ffmpeg; cancelling terminates the worker and bumps `generation`
  // biome-ignore lint/correctness/useExhaustiveDependencies: generation is the restart trigger
  useEffect(() => {
    const ff = new FFmpeg()
    let alive = true
    ff.on('log', ({ message }) => {
      lines.current.push(message)
      const m = !total.current && durationRE.exec(message)
      if (m) total.current = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    })
    ff.on('progress', ({ time }) => total.current && setProgress(Math.min(1, time / 1e6 / total.current)))
    loadWasm()
      .then((wasm) => ff.load({ coreURL, wasmURL: wasm, workerURL }))
      .then(() => alive && setFFmpeg(ff))
      .catch((e: unknown) => alive && setError(`FFmpeg failed to load: ${e instanceof Error ? e.message : e}`))
    return () => {
      alive = false
      ff.terminate()
      setFFmpeg(null)
    }
  }, [generation])

  const startSec = parseTime(start)
  const endSec = parseTime(end)
  const rangeError =
    Number.isNaN(startSec) || Number.isNaN(endSec)
      ? 'Use seconds or h:mm:ss for start and end'
      : endSec !== undefined && endSec <= (startSec ?? 0)
        ? 'End must be after start'
        : null

  const convert = async () => {
    if (!ffmpeg || !file || rangeError) return
    setBusy(true)
    setError(null)
    setResult(null)
    setProgress(null)
    lines.current = []
    // A trimmed clip's length is known up front; otherwise the log's "Duration:" line sets it
    total.current = endSec !== undefined ? endSec - (startSec ?? 0) : 0
    const input = `input${file.name.match(/\.[^./]+$/)?.[0] ?? ''}`
    const output = `output.${format}`
    try {
      await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()))
      const args = buildArgs(input, output, { format, quality, height, start: startSec, end: endSec })
      lines.current.push(`$ ffmpeg ${args.join(' ')}`)
      const code = await ffmpeg.exec(args)
      if (code !== 0) throw new Error(lines.current.slice(-3).join('\n') || `FFmpeg exited with code ${code}`)
      const data = await ffmpeg.readFile(output)
      if (typeof data === 'string' || data.byteLength === 0) throw new Error('FFmpeg produced no output')
      setResult({ data, format })
      // Free the in-memory filesystem; a missing output file is fine
      await Promise.allSettled([ffmpeg.deleteFile(input), ffmpeg.deleteFile(output)])
    } catch (e) {
      // terminate() rejects the pending exec; that's a cancel, not an error
      if (ffmpeg !== ffmpegRef.current) return
      setError(e instanceof Error ? e.message : String(e))
      // A wasm crash leaves the core unusable; start a fresh one for the next run
      cancel()
    } finally {
      setLog(lines.current.join('\n'))
      setBusy(false)
      setProgress(null)
    }
  }

  const cancel = () => {
    ffmpegRef.current = null
    setGeneration((g) => g + 1)
  }

  const clear = () => {
    if (busy) cancel()
    setFile(null)
    setResult(null)
    setError(null)
    setLog('')
    setStart('')
    setEnd('')
  }

  const sourceUrl = useObjectUrl(file ?? undefined, file?.type ?? '')
  const resultType = result ? MIME[result.format] : ''
  const resultUrl = useObjectUrl(result?.data, resultType)
  const audioOnly = AUDIO_ONLY.includes(format)
  const change = result && file ? ((result.data.byteLength - file.size) / file.size) * 100 : 0

  const loading = !ffmpeg && !error && <Spinner label='Loading FFmpeg (~10 MB)…' />

  if (!file)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          onFiles={([f]) => {
            if (!f) return
            setFile(f)
            setResult(null)
            setLog('')
          }}
          accept='video/*,audio/*,.mkv,.mov,.avi,.flv'
          hint='MP4, MOV, WebM, MKV, AVI, MP3, WAV, M4A… Converted on your device; nothing is uploaded.'
        >
          Drop a video or audio file here or click to browse
        </DropZone>
        {loading}
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
            onChange={(e) => setFormat(e.target.value as MediaFormat)}
          >
            <optgroup label='Video'>
              <option value='mp4'>MP4 (H.264)</option>
              <option value='webm'>WebM (VP8)</option>
              <option value='gif'>GIF</option>
            </optgroup>
            <optgroup label='Audio only'>
              <option value='mp3'>MP3</option>
              <option value='m4a'>M4A (AAC)</option>
              <option value='wav'>WAV</option>
            </optgroup>
          </select>
          {format !== 'wav' && (
            <select
              aria-label='Quality'
              className={selectClass}
              value={quality === 'copy' && !canCopy(format) ? 'medium' : quality}
              onChange={(e) => setQuality(e.target.value as MediaQuality)}
            >
              {canCopy(format) && <option value='copy'>Keep streams (no re-encode)</option>}
              <option value='high'>High quality</option>
              <option value='medium'>Balanced</option>
              <option value='small'>Smallest file</option>
            </select>
          )}
          {!audioOnly && (quality !== 'copy' || format === 'gif') && (
            <select
              aria-label='Maximum height'
              className={selectClass}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            >
              <option value={0}>Original size</option>
              {[1080, 720, 480, 360, 240].map((h) => (
                <option key={h} value={h}>
                  ≤ {h}p
                </option>
              ))}
            </select>
          )}
          <label className={inlineLabel}>
            Start
            <Input
              className='h-7 w-20 text-xs'
              placeholder='0:00'
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className={inlineLabel}>
            End
            <Input
              className='h-7 w-20 text-xs'
              placeholder='end'
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {busy ? (
            <Button size='sm' variant='outline' onClick={cancel}>
              <Square /> Cancel
            </Button>
          ) : (
            <Button size='sm' onClick={() => void convert()} disabled={!ffmpeg || !!rangeError}>
              <Play /> Convert
            </Button>
          )}
          {result && (
            <Button
              size='sm'
              variant='outline'
              onClick={() =>
                downloadBlob(result.data, `${file.name.replace(/\.[^/.]+$/, '')}.${result.format}`, resultType)
              }
            >
              <Download /> Download
            </Button>
          )}
          <Button size='sm' variant='ghost' onClick={clear}>
            <Trash2 /> Clear
          </Button>
          {loading}
          {busy && <Spinner label={progress === null ? 'Converting…' : `Converting… ${Math.round(progress * 100)}%`} />}
        </>
      }
    >
      <Alert>{rangeError ?? error}</Alert>
      <Split>
        <Panel
          title='Original'
          actions={
            <span className='flex min-w-0 items-center gap-2 px-1.5 text-xs text-muted-foreground'>
              <span className='max-w-48 truncate' title={file.name}>
                {file.name}
              </span>
              {filesize(file.size, { base: 2 })}
            </span>
          }
        >
          <div className='flex h-full items-center justify-center bg-muted/30 p-2'>
            <Player url={sourceUrl} type={file.type || 'video/'} label='Original' />
          </div>
        </Panel>
        <Panel
          title={result ? `Converted · ${result.format.toUpperCase()}` : 'Converted'}
          actions={
            result && (
              <span className='px-1.5 text-xs text-muted-foreground'>
                {filesize(result.data.byteLength, { base: 2 })}{' '}
                <span className={change < 0 ? 'text-success' : 'text-destructive'}>
                  ({change < 0 ? '' : '+'}
                  {change.toFixed(1)}%)
                </span>
              </span>
            )
          }
        >
          <div className='flex h-full items-center justify-center bg-muted/30 p-2'>
            {result ? (
              <Player url={resultUrl} type={resultType} label='Converted' />
            ) : (
              <span className='text-xs text-muted-foreground'>
                {busy ? 'Converting…' : 'Pick the output and press Convert'}
              </span>
            )}
          </div>
        </Panel>
      </Split>
      {log && (
        <details className='shrink-0 rounded-md border bg-card text-xs'>
          <summary className='flex h-8 cursor-pointer items-center px-2.5 select-none hover:bg-muted/40'>
            FFmpeg log
          </summary>
          <pre className='max-h-48 overflow-auto border-t p-2.5 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground'>
            {log}
          </pre>
        </details>
      )}
    </Workspace>
  )
}

export default MediaConverter
