import { useVirtualizer } from '@tanstack/react-virtual'
import { filesize } from 'filesize'
import { FileCode, FolderOpen, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ResultTable } from '@/components/ResultTable'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { TabButton, TabGroup, TabPanel, TabPanels, Tabs } from '@/components/ui/tabs'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { type BinaryInfo, type FoundString, hex, parseOffset } from '@/lib/binary'
import { cn } from '@/lib/utils'
import type { BinaryRequest, BinaryResponse } from '@/workers/binary.worker'

interface Source {
  name: string
  bytes: Uint8Array
}
interface Parsed {
  info: BinaryInfo | null
  error?: string
  hashes: [string, string][]
}

const size = (n: number) => filesize(n, { base: 2 })

function BinaryExplorer() {
  const [source, setSource] = useToolState<Source | null>('binary:source', null)
  const [parsed, setParsed] = useToolState<Parsed | null>('binary:parsed', null)
  const [tab, setTab] = useToolState('binary:tab', 0)
  const [minLen, setMinLen] = useToolState('binary:min', 6)
  const [filter, setFilter] = useToolState('binary:filter', '')
  const [strings, setStrings] = useToolState<{ min: number; list: FoundString[]; truncated: boolean } | null>(
    'binary:strings',
    null,
  )
  const [busy, setBusy] = useState(false)
  const worker = useRef<Worker | null>(null)
  const jobId = useRef(0)

  useEffect(() => () => worker.current?.terminate(), [])

  const post = (req: BinaryRequest) => {
    worker.current ??= new Worker(new URL('../workers/binary.worker.ts', import.meta.url), { type: 'module' })
    worker.current.onmessage = ({ data: msg }: MessageEvent<BinaryResponse>) => {
      if (msg.id !== jobId.current) return
      setBusy(false)
      if (msg.type === 'parsed') setParsed({ info: msg.info, error: msg.error, hashes: msg.hashes })
      else setStrings({ min: req.type === 'strings' ? req.min : 0, list: msg.strings, truncated: msg.truncated })
    }
    worker.current.onerror = (e) => {
      setBusy(false)
      setParsed({ info: null, error: `The parser failed: ${e.message}`, hashes: [] })
    }
    setBusy(true)
    worker.current.postMessage(req)
  }

  const load = async ([file]: File[]) => {
    if (!file) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    setSource({ name: file.name, bytes })
    setParsed(null)
    setStrings(null)
    post({ type: 'parse', id: ++jobId.current, bytes: bytes.slice() })
  }

  // Strings are extracted lazily, when the tab is open and the minimum length changes
  const wantStrings = source && parsed && tab === 3 && minLen >= 2 && strings?.min !== minLen
  // biome-ignore lint/correctness/useExhaustiveDependencies: post is stable enough; re-run only on these inputs
  useEffect(() => {
    if (!wantStrings) return
    const t = setTimeout(
      () => post({ type: 'strings', id: ++jobId.current, bytes: source.bytes.slice(), min: minLen }),
      200,
    )
    return () => clearTimeout(t)
  }, [wantStrings, minLen, source])

  const info = parsed?.info
  const clear = () => {
    jobId.current++
    setBusy(false)
    setSource(null)
    setParsed(null)
    setStrings(null)
  }

  return (
    <DropTarget onFiles={(f) => void load(f)} label='Drop to open another file'>
      <Workspace
        toolbar={
          <>
            <FileButton size='sm' variant='ghost' onFileSelected={(e) => void load(Array.from(e.target.files ?? []))}>
              <FolderOpen /> Open file
            </FileButton>
            {source && (
              <>
                <Button size='sm' variant='ghost' onClick={clear}>
                  <Trash2 /> Clear
                </Button>
                <span className='flex min-w-0 items-center gap-1.5 text-[13px]'>
                  <FileCode className='size-4 shrink-0 text-muted-foreground' />
                  <span className='truncate'>{source.name}</span>
                  <span className='text-xs text-muted-foreground'>{size(source.bytes.length)}</span>
                </span>
              </>
            )}
            {busy && (
              <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                <Spinner /> Working…
              </span>
            )}
          </>
        }
      >
        {!source ? (
          <DropZone onFiles={(f) => void load(f)} hint='ELF, PE (.exe, .dll) or Mach-O. Stays in your browser.'>
            Drop an executable or library here or click to browse
          </DropZone>
        ) : (
          <>
            <Alert variant='warning'>{parsed?.error && `${parsed.error}. Strings and the hex view still work.`}</Alert>
            <TabGroup selectedIndex={tab} onChange={setTab} className='flex min-h-0 flex-1 flex-col gap-2'>
              <Tabs className='self-start'>
                <TabButton>Overview</TabButton>
                <TabButton>Sections ({info?.regions.length ?? 0})</TabButton>
                <TabButton>Imports / Exports ({(info?.imports.length ?? 0) + (info?.exports.length ?? 0)})</TabButton>
                <TabButton>Strings</TabButton>
                <TabButton>Hex</TabButton>
              </Tabs>
              <TabPanels className='flex min-h-0 flex-1 flex-col'>
                <TabPanel className='flex min-h-0 flex-1 flex-col'>
                  <Panel title='Overview' className='flex-1'>
                    <Overview name={source.name} length={source.bytes.length} parsed={parsed} />
                  </Panel>
                </TabPanel>
                <TabPanel className='flex min-h-0 flex-1 flex-col'>
                  <Panel title='Sections and segments' className='flex-1'>
                    <ResultTable
                      columns={['Kind', 'Name', 'Address', 'Offset', 'File size', 'Memory size', 'Flags', 'Entropy']}
                      numRows={info?.regions.length ?? 0}
                      cell={(r, c) => {
                        const x = info!.regions[r]!
                        return [
                          x.kind,
                          x.name,
                          hex(x.addr),
                          hex(x.offset),
                          hex(x.size),
                          hex(x.memSize),
                          x.flags,
                          x.entropy === null ? '' : x.entropy.toFixed(2),
                        ][c]!
                      }}
                    />
                  </Panel>
                </TabPanel>
                <TabPanel className='flex min-h-0 flex-1 flex-col'>
                  <Split>
                    <Panel title={`Imports (${info?.imports.length ?? 0})`}>
                      <ResultTable
                        columns={['Name', 'Library']}
                        numRows={info?.imports.length ?? 0}
                        cell={(r, c) => {
                          const x = info!.imports[r]!
                          return c ? x.library : x.name
                        }}
                      />
                    </Panel>
                    <Panel title={`Exports (${info?.exports.length ?? 0})`}>
                      <ResultTable
                        columns={['Name', 'Address']}
                        numRows={info?.exports.length ?? 0}
                        cell={(r, c) => {
                          const x = info!.exports[r]!
                          return c ? hex(x.addr) : x.name
                        }}
                      />
                    </Panel>
                  </Split>
                </TabPanel>
                <TabPanel className='flex min-h-0 flex-1 flex-col gap-2'>
                  <StringsView
                    strings={strings}
                    minLen={minLen}
                    setMinLen={setMinLen}
                    filter={filter}
                    setFilter={setFilter}
                  />
                </TabPanel>
                <TabPanel className='flex min-h-0 flex-1 flex-col gap-2'>
                  <HexView bytes={source.bytes} />
                </TabPanel>
              </TabPanels>
            </TabGroup>
          </>
        )}
      </Workspace>
    </DropTarget>
  )
}

function Overview({ name, length, parsed }: { name: string; length: number; parsed: Parsed | null }) {
  const info = parsed?.info
  const rows: [string, string][] = [
    ['File', name],
    ['Size', `${size(length)} (${length.toLocaleString()} bytes)`],
  ]
  if (info) {
    rows.push(
      ['Format', info.format],
      ['Type', info.type],
      ['Architecture', info.arch],
      ['Bitness', `${info.bits}-bit`],
      ['Endianness', info.endian],
      ['Entry point', info.entry === null ? 'None' : hex(info.entry)],
    )
    if (info.timestamp !== undefined)
      rows.push(['Timestamp', `${new Date(info.timestamp * 1000).toISOString()} (${info.timestamp})`])
    rows.push(...info.details)
    if (info.libraries.length) rows.push(['Libraries', info.libraries.join('\n')])
  }
  rows.push(...(parsed?.hashes ?? []))
  return (
    <dl className='text-xs'>
      {rows.map(([k, v]) => (
        <div key={k} className='flex min-h-8 items-start gap-2 border-b py-1.5 pr-1 pl-2.5'>
          <dt className='w-28 shrink-0 pt-0.5 font-medium text-muted-foreground'>{k}</dt>
          <dd className='min-w-0 flex-1 pt-0.5 font-mono break-all whitespace-pre-line'>{v}</dd>
          <CopyButton size='icon-sm' className='-my-1' label={`Copy ${k}`} value={v} />
        </div>
      ))}
    </dl>
  )
}

function StringsView({
  strings,
  minLen,
  setMinLen,
  filter,
  setFilter,
}: {
  strings: { min: number; list: FoundString[]; truncated: boolean } | null
  minLen: number
  setMinLen: (n: number) => void
  filter: string
  setFilter: (s: string) => void
}) {
  const shown = useMemo(() => {
    const q = filter.toLowerCase()
    return q ? (strings?.list.filter((s) => s.text.toLowerCase().includes(q)) ?? []) : (strings?.list ?? [])
  }, [strings, filter])
  return (
    <>
      <div className='flex flex-wrap items-center gap-1.5'>
        <Label htmlFor='binary-min'>Min length</Label>
        <Input
          id='binary-min'
          type='number'
          min={2}
          max={64}
          className='h-7 w-16'
          value={minLen}
          onChange={(e) => setMinLen(Math.min(64, Math.max(2, Number(e.target.value) || 2)))}
        />
        <Input
          aria-label='Filter strings'
          placeholder='Filter…'
          className='h-7 w-56'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className='text-xs text-muted-foreground'>
          {strings && `${shown.length.toLocaleString()} of ${strings.list.length.toLocaleString()}`}
          {strings?.truncated && ' (first 200,000 only)'}
        </span>
        <CopyButton className='ml-auto' value={() => shown.map((s) => s.text).join('\n')} disabled={!shown.length} />
      </div>
      <Panel className='flex-1'>
        <ResultTable
          columns={['Offset', 'Encoding', 'Text']}
          numRows={shown.length}
          cell={(r, c) => {
            const s = shown[r]!
            return c === 0 ? hex(s.offset) : c === 1 ? s.encoding : s.text
          }}
        />
      </Panel>
    </>
  )
}

const ROW = 20
const PER_ROW = 16
const printable = (b: number) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')

function HexView({ bytes }: { bytes: Uint8Array }) {
  const [jump, setJump] = useToolState('binary:jump', '')
  const [mark, setMark] = useState<number | null>(null)
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const rows = Math.ceil(bytes.length / PER_ROW)
  const digits = Math.max(8, bytes.length.toString(16).length)
  const virtual = useVirtualizer({
    count: rows,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW,
    overscan: 20,
  })

  const go = () => {
    const off = parseOffset(jump)
    if (off === null || off >= bytes.length) return setError(`Enter an offset between 0 and ${hex(bytes.length - 1)}`)
    setError('')
    setMark(off)
    virtual.scrollToIndex(Math.floor(off / PER_ROW), { align: 'center' })
  }

  return (
    <>
      <div className='flex flex-wrap items-center gap-1.5'>
        <Label htmlFor='binary-jump'>Offset</Label>
        <Input
          id='binary-jump'
          placeholder='0x1000 or 4096'
          className='h-7 w-40 font-mono'
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          onEnter={go}
        />
        <Button size='sm' variant='outline' onClick={go} disabled={!jump.trim()}>
          Go
        </Button>
        <span className='text-xs text-destructive'>{error}</span>
      </div>
      <Panel className='flex-1'>
        <div ref={scroller} className='h-full overflow-auto py-1 font-mono text-xs'>
          <div className='relative' style={{ height: virtual.getTotalSize() }}>
            {virtual.getVirtualItems().map((item) => {
              const start = item.index * PER_ROW
              const row = bytes.subarray(start, start + PER_ROW)
              const at = mark !== null && mark >= start && mark < start + PER_ROW ? mark - start : -1
              return (
                <div
                  key={item.index}
                  className='absolute inset-x-0 flex gap-4 px-2.5 whitespace-pre'
                  style={{ height: ROW, lineHeight: `${ROW}px`, transform: `translateY(${item.start}px)` }}
                >
                  <span className='text-muted-foreground'>{start.toString(16).padStart(digits, '0')}</span>
                  <span>
                    {Array.from(row, (b, i) => (
                      <span key={i} className={cn(i === at && 'bg-foreground text-background', i === 8 && 'ml-2')}>
                        {b.toString(16).padStart(2, '0')}
                        {i < row.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                    {' '.repeat((PER_ROW - row.length) * 3)}
                  </span>
                  <span className='text-muted-foreground'>
                    {Array.from(row, (b, i) => (
                      <span key={i} className={cn(i === at && 'bg-foreground text-background')}>
                        {printable(b)}
                      </span>
                    ))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Panel>
    </>
  )
}

export default BinaryExplorer
