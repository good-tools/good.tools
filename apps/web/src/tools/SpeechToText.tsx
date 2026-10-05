import { filesize } from 'filesize'
import { Download, Mic, Play, Square, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, paneField, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { type Cue, timestamp, toSrt, toText, toVtt } from '@/lib/subtitles'
import { cn, downloadBlob } from '@/lib/utils'
import type { WhisperModel, WhisperRequest, WhisperResponse } from '@/workers/whisper.worker'

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')

// Whisper's languages
const names = new Intl.DisplayNames(['en'], { type: 'language' })
const languages = (
  'en zh de es ru ko fr ja pt tr pl ca nl ar sv it id hi fi vi he uk el ms cs ro da hu ta no th ur hr bg lt la mi ' +
  'ml cy sk te fa lv bn sr az sl kn et mk br eu is hy ne mn bs kk sq sw gl mr pa si km sn yo so af oc ka be tg sd ' +
  'gu am yi lo uz fo ht ps tk nn mt sa lb my bo tl mg as tt haw ln ha ba jw su yue'
)
  .split(' ')
  .map((code) => [code, names.of(code) ?? code] as const)
  .sort((a, b) => a[1].localeCompare(b[1]))

/** Any audio or video file the browser can play → 16 kHz mono samples, as Whisper expects. */
async function decodeAudio(file: Blob): Promise<Float32Array> {
  let buffer: AudioBuffer
  try {
    // decodeAudioData resamples to the context's rate
    buffer = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(await file.arrayBuffer())
  } catch {
    throw new Error("Your browser can't decode the audio in this file")
  }
  const out = buffer.getChannelData(0).slice()
  for (let c = 1; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < out.length; i++) out[i]! += data[i]!
  }
  if (buffer.numberOfChannels > 1) for (let i = 0; i < out.length; i++) out[i]! /= buffer.numberOfChannels
  return out
}

interface Source {
  name: string
  audio: Float32Array
}

interface Result {
  cues: Cue[]
  language: string
}

export default function SpeechToText() {
  const [model, setModel] = useToolState<WhisperModel>('stt:model', 'tiny')
  const [language, setLanguage] = useToolState('stt:language', '')
  const [source, setSource] = useToolState<Source | null>('stt:source', null)
  const [result, setResult] = useToolState<Result | null>('stt:result', null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
  const worker = useRef<Worker | null>(null)

  useEffect(() => () => worker.current?.terminate(), [])
  // Release the microphone if the page is left mid-recording
  useEffect(
    () => () =>
      recorder?.stream.getTracks().forEach((t) => {
        t.stop()
      }),
    [recorder],
  )

  const transcribe = (audio: Float32Array) => {
    if (!worker.current) {
      worker.current = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' })
      worker.current.onerror = (e) => {
        setError(`Speech recognition failed to load: ${e.message}`)
        setStatus('')
      }
      worker.current.onmessage = ({ data: msg }: MessageEvent<WhisperResponse>) => {
        if (msg.type === 'download')
          setStatus(
            `Downloading model… ${filesize(msg.loaded, { round: 1 })} of ${filesize(msg.total, { round: 1 })} (${Math.floor((msg.loaded / msg.total) * 100)}%)`,
          )
        else if (msg.type === 'status') setStatus(msg.status)
        else {
          setStatus('')
          if (msg.type === 'error') setError(msg.error)
          else setResult({ cues: msg.cues, language: msg.language })
        }
      }
    }
    setError('')
    setResult(null)
    setStatus('Starting…')
    worker.current.postMessage({ audio, model, language } satisfies WhisperRequest)
  }

  const open = async (name: string, file: Blob) => {
    setError('')
    setStatus('Decoding audio…')
    try {
      const audio = await decodeAudio(file)
      if (!audio.length) throw new Error(`${name} has no audio`)
      setSource({ name, audio })
      transcribe(audio)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('')
    }
  }

  const openFiles = ([f]: File[]) => {
    if (f) void open(f.name, f)
  }

  const record = async () => {
    setError('')
    try {
      const rec = new MediaRecorder(await navigator.mediaDevices.getUserMedia({ audio: true }))
      const parts: Blob[] = []
      rec.ondataavailable = (e) => parts.push(e.data)
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => {
          t.stop()
        })
        setRecorder(null)
        void open('Recording', new Blob(parts, { type: rec.mimeType }))
      }
      rec.start()
      setRecorder(rec)
    } catch (e) {
      setError(`Could not use the microphone: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const busy = !!status
  const base = source?.name.replace(/\.[^.]+$/, '') || 'transcript'
  const text = result ? toText(result.cues) : ''

  const toolbar = (
    <>
      <FileButton
        size='sm'
        variant='ghost'
        accept='audio/*,video/*'
        disabled={busy || !!recorder}
        onFileSelected={(e) => openFiles(Array.from(e.target.files ?? []))}
      >
        <Upload /> Open file
      </FileButton>
      {recorder ? (
        <Button size='sm' variant='outline' onClick={() => recorder.stop()}>
          <Square className='fill-destructive text-destructive' /> Stop recording
        </Button>
      ) : (
        <Button size='sm' variant='ghost' onClick={() => void record()} disabled={busy}>
          <Mic /> Record
        </Button>
      )}
      <select
        aria-label='Model'
        className={selectClass}
        value={model}
        onChange={(e) => setModel(e.target.value as WhisperModel)}
        disabled={busy}
      >
        <option value='tiny'>Whisper tiny (40 MB, fastest)</option>
        <option value='base'>Whisper base (75–200 MB)</option>
        <option value='small'>Whisper small (240–560 MB, best)</option>
      </select>
      <select
        aria-label='Language'
        className={selectClass}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        disabled={busy}
      >
        <option value=''>Detect language</option>
        {languages.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      {source && (
        <Button size='sm' onClick={() => transcribe(source.audio)} disabled={busy}>
          <Play /> Transcribe
        </Button>
      )}
      {source && (
        <Button
          size='sm'
          variant='ghost'
          onClick={() => {
            setSource(null)
            setResult(null)
          }}
          disabled={busy}
        >
          <Trash2 /> Clear
        </Button>
      )}
      {status && <Spinner label={status} />}
    </>
  )

  if (!source)
    return (
      <Workspace toolbar={toolbar}>
        <DropZone
          className='py-5'
          accept='audio/*,video/*'
          onFiles={openFiles}
          disabled={!!recorder}
          hint='MP3, WAV, M4A, OGG, WebM, MP4… Transcribed on your device; the audio is never uploaded.'
        >
          {recorder
            ? 'Recording… press Stop recording when done'
            : 'Drop an audio or video file here or click to browse'}
        </DropZone>
        <Alert>{error}</Alert>
      </Workspace>
    )

  const duration = source.audio.length / 16000
  const files: [string, string, string][] = result
    ? [
        ['.txt', text, 'text/plain'],
        ['.srt', toSrt(result.cues), 'application/x-subrip'],
        ['.vtt', toVtt(result.cues), 'text/vtt'],
      ]
    : []

  return (
    <DropTarget onFiles={openFiles} label='Drop to transcribe another file'>
      <Workspace toolbar={toolbar}>
        <Alert>{error}</Alert>
        <Panel
          className='flex-1'
          title={`${source.name} · ${timestamp(duration).slice(0, -4)}${result ? ` · ${names.of(result.language) ?? result.language}` : ''}`}
          actions={
            result && (
              <>
                <CopyButton value={text} />
                {files.map(([ext, content, type]) => (
                  <Button
                    key={ext}
                    size='sm'
                    variant='ghost'
                    onClick={() => downloadBlob(content, base + ext, type)}
                    aria-label={`Download ${ext}`}
                  >
                    <Download /> {ext}
                  </Button>
                ))}
              </>
            )
          }
        >
          {result ? (
            <ol className='divide-y font-mono text-xs'>
              {result.cues.map((c) => (
                <li key={`${c.start}-${c.end}-${c.text}`} className='flex gap-3 px-2.5 py-1.5'>
                  <span className='shrink-0 text-muted-foreground tabular-nums'>{timestamp(c.start).slice(0, -4)}</span>
                  <span className='font-sans text-[13px]'>{c.text.trim()}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Textarea
              aria-label='Transcript'
              readOnly
              className={paneField}
              placeholder='The transcript appears here'
            />
          )}
        </Panel>
      </Workspace>
    </DropTarget>
  )
}
