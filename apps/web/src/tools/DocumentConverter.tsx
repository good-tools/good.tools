import { filesize } from 'filesize'
import { ArrowRight, Download, Eraser, FileText, FlaskConical, FolderOpen, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  ACCEPT,
  baseName,
  type Format,
  formatForFile,
  INPUT_FORMATS,
  inputFormat,
  OUTPUT_FORMATS,
  outputFormat,
  pandocOptions,
} from '@/lib/pandoc'
import { cn, downloadBlob } from '@/lib/utils'
import type { PandocRequest, PandocResponse } from '@/workers/pandoc.worker'

type Done = Extract<PandocResponse, { type: 'done' }>
interface Client {
  worker: Worker
  ready: Promise<string>
  pending: Map<number, { resolve: (r: Done) => void; reject: (e: Error) => void }>
}

// One pandoc worker for the session: loading it costs a ~16 MB download, so it outlives the page
let client: Client | undefined
let nextId = 0
/** pandoc's version once it has loaded */
let version: string | undefined

function pandoc(): Client {
  if (client) return client
  const worker = new Worker(new URL('../workers/pandoc.worker.ts', import.meta.url), { type: 'module' })
  const pending: Client['pending'] = new Map()
  let loaded!: (v: string) => void
  let failed!: (e: Error) => void
  const ready = new Promise<string>((res, rej) => {
    loaded = res
    failed = rej
  })
  const fail = (error: Error) => {
    client = undefined // retry on the next conversion
    worker.terminate()
    failed(error)
    for (const p of pending.values()) p.reject(error)
  }
  worker.onmessage = ({ data }: MessageEvent<PandocResponse>) => {
    if (data.type === 'ready') {
      version = data.version
      return loaded(data.version)
    }
    if (data.id === undefined) return fail(new Error(data.type === 'error' ? data.error : 'pandoc failed'))
    const p = pending.get(data.id)
    pending.delete(data.id)
    if (data.type === 'done') p?.resolve(data)
    else p?.reject(new Error(data.error))
  }
  worker.onerror = (e) => fail(new Error(e.message || 'The pandoc worker failed to start'))
  client = { worker, ready, pending }
  return client
}

function convert(req: Omit<PandocRequest, 'id'>): Promise<Done> {
  const c = pandoc()
  const id = ++nextId
  return new Promise((resolve, reject) => {
    c.pending.set(id, { resolve, reject })
    c.worker.postMessage({ ...req, id })
  })
}

interface Result {
  text: string
  file?: Blob
  warnings: string[]
}

const EXAMPLE = `---
title: Release notes
---

# Overview

**good.tools** converts documents *in your browser* with [pandoc](https://pandoc.org).

## Changes

1. Faster startup
2. New formats: Typst, JATS
   - and plain text

| Format | Binary |
|--------|:------:|
| DOCX   | yes    |
| HTML   | no     |

\`\`\`js
console.log('hello')
\`\`\`

> Everything stays on your device.
`

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')

function FormatSelect({
  label,
  value,
  onChange,
  formats,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  formats: Format[]
}) {
  return (
    <label className='flex items-center gap-1.5 text-xs text-muted-foreground'>
      {label}
      <select aria-label={label} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {formats.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function DocumentConverter() {
  const [from, setFrom] = useToolState('docconv:from', 'markdown')
  const [to, setTo] = useToolState('docconv:to', 'html')
  const [text, setText] = useToolState('docconv:text', '')
  const [file, setFile] = useToolState<File | null>('docconv:file', null)
  const [name, setName] = useToolState('docconv:name', 'document')
  const [standalone, setStandalone] = useToolState('docconv:standalone', false)
  const [toc, setToc] = useToolState('docconv:toc', false)
  const [result, setResult] = useToolState<Result | null>('docconv:result', null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const inFormat = inputFormat(from)
  const outFormat = outputFormat(to)
  const binaryIn = !!inFormat?.binary
  const source = binaryIn ? file : text.trim() ? text : null

  // Live conversion, debounced; stale results are dropped
  useEffect(() => {
    if (!source) {
      setResult(null)
      setError('')
      return
    }
    let stale = false
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const options = pandocOptions({ from, to, standalone, toc }, binaryIn)
        const res = await convert(typeof source === 'string' ? { options, text: source } : { options, file: source })
        if (stale) return
        setResult({ text: res.text, file: res.file, warnings: res.warnings })
        setError('')
      } catch (e) {
        if (stale) return
        setResult(null)
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!stale) setBusy(false)
      }
    }, 300)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [source, from, to, standalone, toc, binaryIn, setResult])

  const load = async (f: File) => {
    const fmt = formatForFile(f.name)
    setName(baseName(f.name))
    if (fmt) setFrom(fmt.id)
    if (fmt?.binary) {
      setFile(f)
      return
    }
    setFile(null)
    setText(await f.text())
  }

  const clear = () => {
    setText('')
    setFile(null)
    setName('document')
  }

  const ext = outFormat?.ext[0] ?? 'txt'
  const outName = `${name}.${ext}`
  const download = () => {
    if (!result) return
    downloadBlob(result.file ?? result.text, outName, result.file ? 'application/octet-stream' : 'text/plain')
  }
  const tocAvailable = standalone || !!outFormat?.binary

  return (
    <Workspace
      toolbar={
        <>
          <FormatSelect label='From' value={from} onChange={setFrom} formats={INPUT_FORMATS} />
          <ArrowRight className='size-3.5 text-muted-foreground' aria-hidden />
          <FormatSelect label='To' value={to} onChange={setTo} formats={OUTPUT_FORMATS} />
          <FileButton
            size='sm'
            variant='ghost'
            accept={ACCEPT}
            onFileSelected={(e) => e.target.files?.[0] && load(e.target.files[0])}
          >
            <FolderOpen /> Open file
          </FileButton>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => {
              setFrom('markdown')
              setName('release-notes')
              setText(EXAMPLE)
            }}
          >
            <FlaskConical /> Example
          </Button>
          <Button size='sm' variant='ghost' onClick={clear} disabled={!text && !file}>
            <Eraser /> Clear
          </Button>
          {busy && <Spinner label={version ? 'Converting…' : 'Loading pandoc (~16 MB)…'} />}
          <div className='ml-auto flex flex-wrap items-center gap-3'>
            <Checkbox
              title='Standalone'
              description='A complete document with header and footer (e.g. <html><head>…), not a fragment'
              checked={standalone || !!outFormat?.binary}
              disabled={!!outFormat?.binary}
              onChange={(e) => setStandalone(e.target.checked)}
            />
            <Checkbox
              title='Table of contents'
              description={tocAvailable ? 'Add a table of contents' : 'Needs a standalone document'}
              checked={toc && tocAvailable}
              disabled={!tocAvailable}
              onChange={(e) => setToc(e.target.checked)}
            />
          </div>
        </>
      }
    >
      <Alert className='font-mono text-xs whitespace-pre-wrap'>{error}</Alert>
      <Alert variant='warning' className='text-xs whitespace-pre-wrap'>
        {!error && result?.warnings.join('\n')}
      </Alert>
      <Split>
        <Panel
          title={inFormat?.label}
          actions={
            binaryIn &&
            file && (
              <Button size='sm' variant='ghost' onClick={() => setFile(null)}>
                <X /> Remove
              </Button>
            )
          }
        >
          {binaryIn ? (
            file ? (
              <DropTarget className='h-full' label='Drop to replace' onFiles={(f) => f[0] && load(f[0])}>
                <div className='flex h-full flex-col items-center justify-center gap-1 p-4 text-center'>
                  <FileText className='size-6 text-muted-foreground' aria-hidden />
                  <span className='text-[13px] font-medium break-all'>{file.name}</span>
                  <span className='text-xs text-muted-foreground'>{filesize(file.size)}</span>
                </div>
              </DropTarget>
            ) : (
              <DropZone
                className='m-2 h-[calc(100%-1rem)]'
                accept={inFormat?.ext.map((e) => `.${e}`).join(',')}
                onFiles={(f) => f[0] && load(f[0])}
                hint={`${inFormat?.label} is a binary format: open a .${inFormat?.ext[0]} file`}
              />
            )
          ) : (
            <DropTarget className='h-full' label='Drop to open' onFiles={(f) => f[0] && load(f[0])}>
              <Textarea
                autoFocus
                aria-label='Document to convert'
                className={cn(paneField, 'font-mono text-xs')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Type or paste ${inFormat?.label ?? 'text'}, or drop a file (Markdown, HTML, LaTeX, DOCX, ODT, EPUB, ipynb…)`}
                spellCheck={false}
              />
            </DropTarget>
          )}
        </Panel>
        <Panel
          title={outFormat?.label ?? to}
          actions={
            <>
              {!outFormat?.binary && <CopyButton value={result?.text ?? ''} disabled={!result?.text} />}
              <Button size='sm' variant='ghost' disabled={!result} onClick={download}>
                <Download /> .{ext}
              </Button>
            </>
          }
        >
          {outFormat?.binary ? (
            <div className='flex h-full flex-col items-center justify-center gap-2 p-4 text-center'>
              {result?.file ? (
                <>
                  <FileText className='size-6 text-muted-foreground' aria-hidden />
                  <span className='text-[13px] font-medium break-all'>{outName}</span>
                  <span className='text-xs text-muted-foreground'>{filesize(result.file.size)}</span>
                  <Button size='sm' onClick={download}>
                    <Download /> Download
                  </Button>
                </>
              ) : (
                <span className='text-[13px] text-muted-foreground'>The {outFormat.label} file appears here</span>
              )}
            </div>
          ) : (
            <Textarea
              readOnly
              aria-label='Converted document'
              className={cn(paneField, 'font-mono text-xs')}
              value={result?.text ?? ''}
              placeholder='Result appears here as you type'
              spellCheck={false}
            />
          )}
        </Panel>
      </Split>
    </Workspace>
  )
}
