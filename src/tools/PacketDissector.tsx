import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Info, ListTree, Settings2, Shuffle } from 'lucide-react'
import { FileButton } from '@/components/ui/file-button'
import { Input } from '@/components/ui/input'
import DissectionTree, {
  NO_SELECTION,
  type DissectionNode,
  type DissectionSelection,
} from '@/components/DissectionTree'
import DissectionDump from '@/components/DissectionDump'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import PacketVirtualTable, { type PacketRow } from '@/components/PacketVirtualTable'
import { Button } from '@/components/ui/button'
import PacketSummaryModal, { type PacketSummary } from '@/components/PacketSummaryModal'
import { TabButton, TabGroup, TabPanel, TabPanels, Tabs } from '@/components/ui/tabs'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Toolbar } from '@/components/ui/toolbar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createWiregasmClient, type WiregasmClient } from '@/lib/wiregasm-client'
import WiregasmPreferencesModal from '@/components/WiregasmPreferencesModal'
import type { ModuleNode } from '@/components/WiregasmPreferenceTree'
import type { Preference } from '@/components/WiregasmModulePreferences'

// Named explicitly: the bundled URLs carry a content hash
const EXAMPLE_CAPTURES = [
  { name: 'http.cap', url: new URL('../examples/captures/http.cap', import.meta.url) },
  { name: 'bfd-raw-auth-simple.pcap', url: new URL('../examples/captures/bfd-raw-auth-simple.pcap', import.meta.url) },
  { name: 'dns.cap', url: new URL('../examples/captures/dns.cap', import.meta.url) },
]

const decodeBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

interface SelectedPacket {
  tree: DissectionNode[]
  data_sources: Array<{
    name: string
    data: string
  }>
}

interface LoadResult {
  code: number
  error?: string
  summary: PacketSummary
}

interface FramesResult {
  frames: PacketRow[]
  matched: number
}

function PacketDissector() {
  const clientRef = useRef<WiregasmClient | null>(null)

  const [version, setVersion] = useState<string | null>(null)
  const [totalFrames, setTotalFrames] = useState(0)
  const [matchedFrames, setMatchedFrames] = useState(0)
  const [status, setStatus] = useState('Loading…')
  const [error, setError] = useState<string | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [filterError, setFilterError] = useState<string | null>(null)
  const [currentFilter, setCurrentFilter] = useState('')
  const [selectedFrame, setSelectedFrame] = useState(1)
  const [selectedPacket, setSelectedPacket] = useState<SelectedPacket | null>(null)
  const [preparedPositions, setPreparedPositions] = useState<Map<string, DissectionSelection>>(new Map())
  const [selectedTreeEntry, setSelectedTreeEntry] = useState<DissectionSelection>(NO_SELECTION)
  const [finishedProcessing, setFinishedProcessing] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [summary, setSummary] = useState<PacketSummary | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [selectedDataSourceIndex, setSelectedDataSourceIndex] = useState(0)
  const [fileName, setFileName] = useState('')
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [dissectionNonce, setDissectionNonce] = useState(0)

  const call: WiregasmClient['call'] = useCallback((method, ...args) => {
    if (!clientRef.current) return Promise.reject(new Error('Wireshark is not loaded'))
    return clientRef.current.call(method, ...args)
  }, [])

  const clear = useMemo(
    () => () => {
      setSelectedFrame(1)
      setSelectedPacket(null)
      setPreparedPositions(new Map())
      setSelectedTreeEntry(NO_SELECTION)
      setSelectedDataSourceIndex(0)
    },
    [],
  )

  useEffect(() => {
    setSelectedDataSourceIndex(selectedTreeEntry.idx)
  }, [selectedTreeEntry])

  const handleLoadResult = useCallback((name: string, res: LoadResult | null) => {
    setFinishedProcessing(true)
    if (!res) return
    setFileName(name)
    // -12 is a short read: the capture is truncated but the frames before it are usable
    if (res.code === 0 || res.code === -12) {
      setDissectionNonce((n) => n + 1)
      setError(
        res.code === 0 ? null : 'The capture file appears to be truncated; showing the frames that could be read.',
      )
      setTotalFrames(res.summary.packet_count)
      setSummary(res.summary)
    } else {
      setError(res.error || `Wireshark could not read this file (code ${res.code}).`)
      setTotalFrames(0)
      setMatchedFrames(0)
    }
  }, [])

  const processData = useCallback(
    (name: string, data: ArrayBuffer) => {
      clear()
      setSummary(null)
      setError(null)
      setFinishedProcessing(false)
      call('load', name, data)
        .then((res) => handleLoadResult(name, res as LoadResult))
        .catch((e: unknown) => {
          setFinishedProcessing(true)
          setError(String(e))
        })
    },
    [call, clear, handleLoadResult],
  )

  const loadExample = useCallback(async () => {
    const { name, url } = EXAMPLE_CAPTURES[Math.floor(Math.random() * EXAMPLE_CAPTURES.length)]!
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      processData(name, await res.arrayBuffer())
    } catch (e) {
      setError(`Could not load example capture: ${String(e)}`)
    }
  }, [processData])

  const preparePositions = useMemo(
    () =>
      (id: string, node: DissectionNode): Map<string, DissectionSelection> => {
        let map = new Map<string, DissectionSelection>()

        if (node.tree && node.tree.length > 0) {
          for (let i = 0; i < node.tree.length; i++) {
            const childNode = node.tree[i]
            if (childNode) {
              map = new Map([...map, ...preparePositions(`${id}-${i}`, childNode)])
            }
          }
        } else if (node.length > 0) {
          map.set(id, {
            id: id,
            idx: node.data_source_idx,
            start: node.start,
            length: node.length,
          })
        }

        return map
      },
    [],
  )

  const findSelection = useMemo(
    () => (src_idx: number, pos: number) => {
      // find the smallest one
      let current: string | null = null

      for (const [k, pp] of preparedPositions) {
        if (pp.idx !== src_idx) continue

        if (pos >= pp.start && pos < pp.start + pp.length) {
          if (current == null || preparedPositions.get(current)!.length > pp.length) current = k
        }
      }

      if (current != null) {
        const selection = preparedPositions.get(current)
        if (selection) {
          setSelectedTreeEntry(selection)
        }
      }
    },
    [preparedPositions],
  )

  useEffect(() => {
    if (!initialized) return
    call('checkFilter', filter).then(
      () => setFilterError(null),
      (e: unknown) => setFilterError(e instanceof Error ? e.message : String(e)),
    )
  }, [call, filter, initialized])

  useEffect(() => {
    // Created inside the effect so StrictMode's double-invoke gets a fresh worker
    const client = createWiregasmClient((e) => {
      if (e.event === 'status') setStatus(e.message)
      else if (e.event === 'error') setError(e.message)
      else {
        setStatus('Ready')
        setInitialized(true)
        client.call('columns').then(setColumns, () => {})
        client.call('version').then(setVersion, () => {})
      }
    })
    clientRef.current = client
    clear()
    return () => {
      client.terminate()
      clientRef.current = null
    }
  }, [clear])

  useEffect(() => {
    if (!finishedProcessing || selectedFrame < 1 || selectedFrame > totalFrames) return
    let cancelled = false
    call('frame', selectedFrame).then(
      (frame) => {
        if (cancelled) return
        const packet = frame as unknown as SelectedPacket
        setSelectedPacket(packet)
        setPreparedPositions(preparePositions('root', packet as unknown as DissectionNode))
        setSelectedTreeEntry(NO_SELECTION)
        setSelectedDataSourceIndex(0)
      },
      (e: unknown) => !cancelled && setError(String(e)),
    )
    return () => {
      cancelled = true
    }
  }, [call, preparePositions, selectedFrame, totalFrames, finishedProcessing, dissectionNonce])

  const dataSources = useMemo(
    () => selectedPacket?.data_sources.map((ds) => ({ name: ds.name, bytes: decodeBase64(ds.data) })) ?? [],
    [selectedPacket],
  )

  const fetchPackets = useCallback(
    async (filter: string, skip: number, limit: number) => {
      if (!initialized || !finishedProcessing) return []
      const res = (await call('frames', filter, skip, limit)) as unknown as FramesResult
      setMatchedFrames(res.matched)
      return res.frames
    },
    [call, initialized, finishedProcessing],
  )

  const loadFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) void f.arrayBuffer().then((buf) => processData(f.name, buf))
    },
    [processData],
  )

  const loadModuleTree = useCallback(async () => (await call('listModules')) as unknown as ModuleNode[], [call])
  const loadPreferences = useCallback(
    async (name: string) => (await call('listPrefs', name)) as unknown as Preference[],
    [call],
  )
  const uploadFile = useCallback(async (file: File) => call('uploadFile', file.name, await file.arrayBuffer()), [call])
  const updatePreference = useCallback(
    async (module: string, key: string, value: string) => {
      await call('setPref', module, key, value)
    },
    [call],
  )
  const applyPreferences = useCallback(async () => {
    await call('applyPrefs')
    if (!fileName) return
    setFinishedProcessing(false)
    handleLoadResult(fileName, await call('reload'))
  }, [call, fileName, handleLoadResult])

  return (
    <div className='flex h-tool flex-col gap-2'>
      <PacketSummaryModal open={summaryOpen} setOpen={setSummaryOpen} summary={summary} name={fileName} />
      <WiregasmPreferencesModal
        initialized={initialized}
        open={preferencesOpen}
        setOpen={setPreferencesOpen}
        loadModuleTree={loadModuleTree}
        loadPreferences={loadPreferences}
        uploadFile={uploadFile}
        updatePreference={updatePreference}
        applyPreferences={applyPreferences}
      />
      <Toolbar className='shrink-0'>
        <FileButton variant='default' size='sm' onFileSelected={loadFile} disabled={!initialized}>
          <FileUp /> Open capture
        </FileButton>
        <Button size='sm' variant='outline' onClick={() => void loadExample()} disabled={!initialized}>
          <Shuffle /> Example
        </Button>
        <Button size='sm' variant='ghost' onClick={() => setPreferencesOpen(true)} disabled={!initialized}>
          <Settings2 /> Preferences
        </Button>
        {summary != null && (
          <Button size='sm' variant='ghost' onClick={() => setSummaryOpen(true)}>
            <Info /> Summary
          </Button>
        )}
        <div className='ml-auto flex items-center gap-3 text-xs text-muted-foreground'>
          {(!initialized || !finishedProcessing) && (
            <Spinner className='size-3.5' label={initialized ? 'Dissecting…' : status} />
          )}
          {fileName && <span className='font-mono text-foreground'>{fileName}</span>}
          <span>
            <ListTree className='mr-1 inline size-3.5' />
            {matchedFrames.toLocaleString()} / {totalFrames.toLocaleString()} packets
          </span>
          {version != null && <span title='Wireshark version'>Wireshark {version}</span>}
        </div>
      </Toolbar>
      <Alert>{error}</Alert>
      <div className='flex items-center gap-2'>
        <Input
          type='text'
          name='filter'
          aria-label='Display filter'
          aria-invalid={filterError != null && filter !== ''}
          aria-describedby='pd-filter-error'
          className={cn(
            'h-8 font-mono',
            filterError != null &&
              filter !== '' &&
              'border-destructive focus:border-destructive focus:ring-destructive/25',
          )}
          placeholder='tcp.port == 443'
          value={filter}
          onEnter={() => filterError == null && setCurrentFilter(filter)}
          onChange={(e) => setFilter(e.target.value)}
          autoComplete='off'
          spellCheck={false}
        />
        {currentFilter && (
          <Badge variant='success' className='shrink-0 font-mono'>
            {currentFilter}
          </Badge>
        )}
      </div>
      {filterError != null && filter !== '' && (
        <p id='pd-filter-error' className='text-xs text-destructive'>
          {filterError}
        </p>
      )}
      <div className='min-h-0 flex-1'>
        <Allotment vertical>
          <Allotment.Pane minSize={120} preferredSize='45%'>
            <div className='h-full pb-1'>
              <PacketVirtualTable
                columns={columns}
                fileName={fileName}
                filter={currentFilter}
                fetchPackets={fetchPackets}
                total={matchedFrames}
                selectedFrame={selectedFrame}
                setSelectedFrame={setSelectedFrame}
                dissectionNonce={dissectionNonce}
              />
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={120}>
            {selectedPacket != null && (
              <div className='h-full pt-1'>
                <Allotment>
                  <Allotment.Pane minSize={200}>
                    <div className='mr-1 h-full overflow-auto rounded-md border bg-card p-2 font-mono text-xs whitespace-nowrap select-none'>
                      <DissectionTree
                        id='root'
                        select={setSelectedTreeEntry}
                        selected={selectedTreeEntry.id}
                        tree={selectedPacket.tree}
                        root
                      />
                    </div>
                  </Allotment.Pane>
                  <Allotment.Pane minSize={200}>
                    <div className='ml-1 h-full overflow-auto rounded-md border bg-card p-2'>
                      <TabGroup selectedIndex={selectedDataSourceIndex} onChange={setSelectedDataSourceIndex}>
                        <Tabs className='text-xs'>
                          {dataSources.map((ds, idx) => (
                            <TabButton className='px-2 py-0.5' key={idx}>
                              {ds.name}
                            </TabButton>
                          ))}
                        </Tabs>
                        <TabPanels className='mt-2'>
                          {dataSources.map((ds, idx) => (
                            <TabPanel key={idx}>
                              <DissectionDump
                                buffer={ds.bytes}
                                select={(pos) => findSelection(idx, pos)}
                                selected={
                                  idx === selectedTreeEntry.idx
                                    ? [selectedTreeEntry.start, selectedTreeEntry.length]
                                    : [0, 0]
                                }
                              />
                            </TabPanel>
                          ))}
                        </TabPanels>
                      </TabGroup>
                    </div>
                  </Allotment.Pane>
                </Allotment>
              </div>
            )}
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  )
}

export default PacketDissector
