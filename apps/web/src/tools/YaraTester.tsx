import type { Monaco } from '@monaco-editor/react'
import { filesize } from 'filesize'
import { Eraser, FilePlus, FileText, Play, X } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeEditor } from '@/components/ui/code-editor'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  EXAMPLE_RULE,
  EXAMPLE_SAMPLE,
  MAX_MATCHES_PER_PATTERN,
  type Sample,
  type SampleResult,
  type YaraResult,
} from '@/lib/yara'
import type { YaraRequest, YaraResponse } from '@/workers/yara.worker'

const TIMEOUT_MS = 10_000
const PASTED = 'Pasted text'

export default function YaraTester() {
  const [source, setSource] = useToolState('yara:source', '')
  const [files, setFiles] = useToolState<Sample[]>('yara:files', [])
  const [text, setText] = useToolState('yara:text', '')
  const [result, setResult] = useToolState<YaraResult | null>('yara:result', null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ed, setEd] = useState<{ editor: editor.IStandaloneCodeEditor; monaco: Monaco } | null>(null)
  const worker = useRef<Worker | null>(null)

  useEffect(() => () => worker.current?.terminate(), [])

  const addFiles = async (list: File[]) => {
    const added = await Promise.all(
      list.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
    )
    setFiles((cur) => [...cur, ...added])
  }

  const samples = text ? [...files, { name: PASTED, bytes: new TextEncoder().encode(text) }] : files

  const scan = () => {
    setBusy(true)
    setError('')
    worker.current ??= new Worker(new URL('../workers/yara.worker.ts', import.meta.url), { type: 'module' })
    const w = worker.current
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      clearTimeout(timer)
      setBusy(false)
    }
    w.onmessage = ({ data }: MessageEvent<YaraResponse>) => {
      if (data.type === 'start') {
        // The YARA-X scan timeout doesn't fire in wasm, so a runaway condition is stopped by killing the worker
        timer = setTimeout(() => {
          w.terminate()
          worker.current = null
          finish()
          setResult(null)
          setError(
            `Scanning took longer than ${TIMEOUT_MS / 1000} s and was stopped. Check for loops over large ranges or very slow conditions.`,
          )
        }, TIMEOUT_MS)
        return
      }
      finish()
      if (data.type === 'done') setResult(data.result)
      else setError(`Could not run YARA-X: ${data.error}`)
    }
    w.postMessage({ source, samples } satisfies YaraRequest)
  }

  // Underline compiler errors and warnings in the editor
  const diagnostics = result?.diagnostics ?? []
  useEffect(() => {
    const model = ed?.editor.getModel()
    if (!ed || !model) return
    const diagnostics = result?.diagnostics ?? []
    ed.monaco.editor.setModelMarkers(
      model,
      'yara',
      diagnostics
        .filter((d) => d.line)
        .map((d) => ({
          severity: d.severity === 'error' ? ed.monaco.MarkerSeverity.Error : ed.monaco.MarkerSeverity.Warning,
          message: d.title,
          startLineNumber: d.line ?? 1,
          startColumn: d.column ?? 1,
          endLineNumber: d.line ?? 1,
          endColumn: model.getLineMaxColumn(d.line ?? 1),
        })),
    )
  }, [ed, result])

  const errors = diagnostics.filter((d) => d.severity === 'error')
  const warnings = diagnostics.filter((d) => d.severity === 'warning')
  const report = (list: typeof diagnostics) =>
    list.length > 0 && (
      <div className='space-y-2'>
        {list.map((d) => (
          <pre key={d.text} className='overflow-x-auto font-mono text-xs whitespace-pre'>
            {d.text}
          </pre>
        ))}
      </div>
    )

  const loadExample = () => {
    setSource(EXAMPLE_RULE)
    setText(EXAMPLE_SAMPLE)
    setResult(null)
  }

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={scan} disabled={busy || !source.trim() || !samples.length}>
            {busy ? <Spinner className='size-3.5 text-primary-foreground' /> : <Play />} Scan
          </Button>
          <Button size='sm' variant='ghost' onClick={loadExample}>
            <FileText /> Load example
          </Button>
          <FileButton
            size='sm'
            variant='ghost'
            multiple
            onFileSelected={(e) => addFiles(Array.from(e.target.files ?? []))}
          >
            <FilePlus /> Add files
          </FileButton>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => {
              setFiles([])
              setText('')
              setResult(null)
            }}
            disabled={!files.length && !text}
          >
            <Eraser /> Clear samples
          </Button>
        </>
      }
    >
      <Alert>{error}</Alert>
      <Alert>{report(errors)}</Alert>
      <Alert variant='warning' className='max-h-40 overflow-auto'>
        {report(warnings)}
      </Alert>
      <Split>
        <Panel title='Rule'>
          <CodeEditor
            value={source}
            onChange={(v) => setSource(v ?? '')}
            onMount={(e, monaco) => {
              setEd({ editor: e, monaco })
              e.onDidDispose(() => setEd(null))
            }}
            options={{ ariaLabel: 'YARA rule', tabSize: 4, contextmenu: false }}
          />
        </Panel>
        <div className='grid min-h-0 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] gap-2'>
          <DropTarget onFiles={addFiles} className='min-h-0'>
            <Panel title={`Samples · ${samples.length}`} className='h-full'>
              <div className='flex h-full flex-col'>
                {files.length ? (
                  <ul className='max-h-32 shrink-0 overflow-auto border-b text-[13px]'>
                    {files.map((f, i) => (
                      <li key={`${i}-${f.name}`} className='flex items-center gap-2 py-0.5 pr-1 pl-2.5'>
                        <span className='min-w-0 flex-1 truncate'>{f.name}</span>
                        <span className='text-xs text-muted-foreground'>{filesize(f.bytes.length, { base: 2 })}</span>
                        <Button
                          size='icon-sm'
                          variant='ghost'
                          aria-label={`Remove ${f.name}`}
                          onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <DropZone
                    multiple
                    onFiles={addFiles}
                    className='m-2 shrink-0 py-3'
                    hint='Any file type, scanned locally'
                  >
                    Drop sample files here or click to browse
                  </DropZone>
                )}
                <Textarea
                  aria-label='Sample text'
                  className='min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent p-2.5 font-mono text-xs focus:border-0 focus:ring-0'
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder='…or paste text to scan'
                />
              </div>
            </Panel>
          </DropTarget>
          <Panel title='Matches'>
            {busy ? (
              <div className='p-2.5'>
                <Spinner label='Scanning…' />
              </div>
            ) : result?.samples ? (
              result.samples.map((s, i) => <SampleMatches key={`${i}-${s.name}`} sample={s} />)
            ) : (
              <p className='p-2.5 text-[13px] text-muted-foreground'>
                {result ? 'Fix the rule errors above, then scan again.' : 'Write a rule, add samples and press Scan.'}
              </p>
            )}
          </Panel>
        </div>
      </Split>
    </Workspace>
  )
}

function SampleMatches({ sample }: { sample: SampleResult }) {
  const n = sample.matches.length
  return (
    <section className='border-b last:border-0'>
      <header className='flex items-center gap-2 bg-muted/30 px-2.5 py-1 text-[13px]'>
        <span className='min-w-0 flex-1 truncate font-medium'>{sample.name}</span>
        <span className='text-xs text-muted-foreground'>{filesize(sample.size, { base: 2 })}</span>
        <Badge variant={sample.error ? 'destructive' : n ? 'warning' : 'outline'}>
          {sample.error ? 'error' : `${n} rule${n === 1 ? '' : 's'} matched`}
        </Badge>
      </header>
      {sample.error && <p className='px-2.5 py-1 text-xs text-destructive'>{sample.error}</p>}
      {sample.matches.map((m) => (
        <div key={`${m.namespace}:${m.identifier}`} className='space-y-1 border-t px-2.5 py-1.5 text-xs'>
          <div className='flex flex-wrap items-center gap-1'>
            <span className='font-mono text-[13px] font-medium'>{m.identifier}</span>
            {m.namespace !== 'default' && <span className='text-muted-foreground'>({m.namespace})</span>}
            {m.tags.map((t) => (
              <Badge key={t} variant='outline'>
                {t}
              </Badge>
            ))}
          </div>
          {m.metadata.length > 0 && (
            <dl className='grid grid-cols-[auto_1fr] gap-x-3 text-muted-foreground'>
              {m.metadata.map((md, i) => (
                <div key={`${i}-${md.identifier}`} className='contents'>
                  <dt>{md.identifier}</dt>
                  <dd className='break-all text-foreground'>{JSON.stringify(md.value)}</dd>
                </div>
              ))}
            </dl>
          )}
          {m.patterns.length > 0 && (
            <table className='w-full font-mono'>
              <thead className='text-left text-muted-foreground'>
                <tr>
                  <th className='pr-3 font-normal'>String</th>
                  <th className='pr-3 font-normal'>Offset</th>
                  <th className='pr-3 font-normal'>Len</th>
                  <th className='pr-3 font-normal'>Hex</th>
                  <th className='font-normal'>ASCII</th>
                </tr>
              </thead>
              <tbody>
                {m.patterns.flatMap((p) =>
                  p.matches.map((x) => (
                    <tr key={`${p.identifier}@${x.offset}`} className='align-top'>
                      <td className='pr-3'>{p.identifier}</td>
                      <td className='pr-3 whitespace-nowrap' title={`${x.offset}`}>
                        0x{x.offset.toString(16)}
                      </td>
                      <td className='pr-3'>{x.length}</td>
                      <td className='pr-3 break-all text-muted-foreground'>
                        {x.hex}
                        {x.truncated && ' …'}
                      </td>
                      <td className='break-all whitespace-pre-wrap'>
                        {x.ascii}
                        {x.truncated && '…'}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
          {m.patterns.some((p) => p.matches.length >= MAX_MATCHES_PER_PATTERN) && (
            <p className='text-muted-foreground'>Showing the first {MAX_MATCHES_PER_PATTERN} matches of each string.</p>
          )}
        </div>
      ))}
    </section>
  )
}
