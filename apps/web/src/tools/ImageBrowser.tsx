import { filesize } from 'filesize'
import { LRUCache as LRU } from 'lru-cache'
import { ArrowRight, ChevronRight, Container, Download, Shuffle, X } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import FileTree, { type FileNode } from '@/components/FileTree'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CodeEditor } from '@/components/ui/code-editor'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { API_CONFIG } from '@/config/api.config'
import { getJSON } from '@/hooks/useApiQuery'
import { useToolState } from '@/hooks/useToolState'
import { formatDateTime } from '@/lib/utils'
import type { DockerFileListItem, DockerFileNode, DockerImageResponse } from '@/types/api.types'

const RANDOM_IMAGES = [
  'docker.io/library/nginx:latest',
  'docker.io/library/memcached:latest',
  'docker.io/library/golang:latest',
]

const isReadable = (mime?: string): boolean =>
  mime !== undefined && (mime.includes('text/') || mime.includes('application/json'))

const downloadUrl = (ref: string, path: string) =>
  `${API_CONFIG.baseUrl}/image/file?${new URLSearchParams({ ref, path })}`

const listCache = new LRU<string, FileNode[]>({ max: 100 })
const contentCache = new LRU<string, string>({ max: 50 })

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className='inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-mono'>{children}</span>
    </span>
  )
}

const kvTable = (rows: [string, string][]) => (
  <table className='w-full text-xs'>
    <tbody className='font-mono'>
      {rows.map(([k, v], i) => (
        <tr key={i} className='h-7 border-b last:border-0'>
          <td className='px-2.5 align-top whitespace-nowrap text-muted-foreground'>{k}</td>
          <td className='px-2.5 break-all'>{v}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

function ImageBrowser() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useToolState<DockerImageResponse | null>('docker:data', null)
  const [ref, setRef] = useToolState('docker:ref', '')
  const [pulledRef, setPulledRef] = useToolState('docker:pulledRef', '')
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [content, setContent] = useToolState('docker:content', '')
  const [selected, setSelected] = useToolState<DockerFileNode | null>('docker:selected', null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const selectAbort = useRef<AbortController | null>(null)

  const reset = (nextRef: string) => {
    setRef(nextRef)
    setPulledRef('')
    setData(null)
    setError(null)
  }

  // Reset the viewer when a different image is pulled (not on mount, which restores the previous session)
  const shownRef = useRef(pulledRef)
  useEffect(() => {
    if (shownRef.current === pulledRef) return
    shownRef.current = pulledRef
    selectAbort.current?.abort()
    setSelected(null)
    setContent('')
    setListError(null)
    setFileError(null)
  }, [pulledRef, setContent, setSelected])

  const select = useCallback(
    async (fileNode: FileNode) => {
      // a newer selection supersedes any in-flight download
      selectAbort.current?.abort()
      const ctrl = new AbortController()
      selectAbort.current = ctrl

      const node = fileNode as unknown as DockerFileNode
      setContent('')
      setFileError(null)
      setSelected(node)

      if (!isReadable(node.mime_type)) return

      const cacheKey = `${pulledRef}:${node.id}`
      const cached = contentCache.get(cacheKey)
      if (cached !== undefined) {
        setContent(cached)
        return
      }

      try {
        const response = await fetch(downloadUrl(pulledRef, node.id), { signal: ctrl.signal })
        if (!response.ok) throw new Error(`Failed to load file (HTTP ${response.status})`)
        const text = await response.text()
        if (ctrl.signal.aborted) return
        // ponytail: whole file held in memory; cap by size if huge files become a problem
        contentCache.set(cacheKey, text)
        setContent(text)
      } catch (e) {
        if (!ctrl.signal.aborted) setFileError(e instanceof Error ? e.message : 'Failed to load file')
      }
    },
    [pulledRef, setContent, setSelected],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll back to the top when a new file is shown
  useEffect(() => {
    editorRef.current?.setScrollPosition({ scrollTop: 0 })
  }, [content])

  const list = useCallback(
    async (node: FileNode | null): Promise<FileNode[]> => {
      const path = node === null ? '' : (node.id as string)
      const cacheKey = `${pulledRef}:${path}`
      const cached = listCache.get(cacheKey)
      if (cached) return cached

      try {
        const fileList = await getJSON<DockerFileListItem[]>(
          '/image/list',
          { ref: pulledRef, path },
          'Failed to list files',
        )
        const result = fileList
          .map((d) => ({ id: `${path}/${d.name}`, ...d }))
          .sort((a, b) => +b.directory - +a.directory || a.name.localeCompare(b.name))
        listCache.set(cacheKey, result)
        return result
      } catch (e) {
        setListError(e instanceof Error ? e.message : 'Failed to list files')
        return []
      }
    },
    [pulledRef],
  )

  const pull = async () => {
    const image = ref.trim()
    if (!image) return

    setData(null)
    setError(null)
    setLoading(true)
    try {
      const result = await getJSON<DockerImageResponse>('/image', { ref: image }, 'Failed to pull image')
      setPulledRef(image)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const config = data?.image.config
  const layers = data?.image.rootfs?.diff_ids ?? []

  const env = (config?.Env ?? []).map((e): [string, string] => {
    const i = e.indexOf('=')
    return i < 0 ? [e, ''] : [e.slice(0, i), e.slice(i + 1)]
  })

  return (
    <Workspace
      toolbar={
        <>
          <Input
            autoFocus
            aria-label='Image reference'
            className='max-w-md flex-1 font-mono'
            value={ref}
            disabled={loading}
            onChange={(e) => setRef(e.target.value)}
            onEnter={() => void pull()}
            placeholder='docker.io/library/nginx:latest'
          />
          <Button size='sm' onClick={() => void pull()} disabled={loading || !ref.trim()}>
            <Container /> Pull
          </Button>
          <Button
            variant='ghost'
            size='sm'
            disabled={loading}
            onClick={() => reset(RANDOM_IMAGES[Math.floor(Math.random() * RANDOM_IMAGES.length)] ?? '')}
          >
            <Shuffle /> Random example
          </Button>
          <Button variant='ghost' size='sm' disabled={loading || !ref} onClick={() => reset('')}>
            <X /> Clear
          </Button>
          {loading && <Spinner label='Pulling image…' />}
        </>
      }
    >
      <Alert>{error}</Alert>
      {data == null || !config ? (
        !loading &&
        !error && (
          <p className='text-xs text-muted-foreground'>Enter an image reference and pull to browse its files.</p>
        )
      ) : (
        <>
          <details className='group shrink-0 rounded-md border bg-card text-xs'>
            <summary className='flex h-8 cursor-pointer list-none items-center gap-x-4 overflow-hidden px-2.5 select-none hover:bg-muted/40'>
              <ChevronRight className='size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90' />
              <span className='min-w-0 truncate font-mono font-medium' title={data.metadata.name}>
                {data.metadata.name}
              </span>
              <Meta label='Platform'>
                {data.image.os}/{data.image.architecture}
              </Meta>
              <Meta label='Size'>{filesize(data.metadata.size, { base: 2 })}</Meta>
              <span title={formatDateTime(data.image.created)}>
                <Meta label='Created'>{data.image.created.slice(0, 10)}</Meta>
              </span>
              <Meta label='Layers'>{layers.length}</Meta>
              <span className='ml-auto max-xl:hidden'>
                <Meta label='Digest'>{data.metadata.digest.slice(0, 19)}…</Meta>
              </span>
            </summary>
            <div className='grid max-h-[40dvh] gap-2 overflow-auto border-t p-2 lg:grid-cols-2'>
              <Panel
                title='Config'
                actions={<CopyButton value={data.metadata.digest} size='icon-sm' label='Copy digest' />}
              >
                {kvTable([
                  ['Digest', data.metadata.digest],
                  ['User', config.User || '—'],
                  ['Entrypoint', config.Entrypoint?.join(' ') || '—'],
                  ['Command', config.Cmd?.join(' ') || '—'],
                  ...Object.entries(config.Labels ?? {}),
                ])}
              </Panel>
              <Panel title={`Environment (${env.length})`}>{kvTable(env)}</Panel>
              <Panel title={`Layers (${layers.length})`} className='lg:col-span-2'>
                {kvTable(layers.map((d, i) => [String(i + 1), d]))}
              </Panel>
            </div>
          </details>
          <Alert>{listError}</Alert>
          <Split className='lg:grid-cols-[minmax(14rem,1fr)_3fr]'>
            <Panel title='Files'>
              <div className='py-1'>
                <FileTree key={pulledRef} load={list} select={select} />
              </div>
            </Panel>
            <Panel
              title={
                selected ? (
                  <span className='flex items-center gap-1 font-mono tracking-normal normal-case'>
                    <span className='break-all text-foreground'>{selected.id}</span>
                    {selected.symlink !== undefined && (
                      <>
                        <ArrowRight className='size-3 shrink-0' />
                        <span className='break-all'>{selected.symlink}</span>
                      </>
                    )}
                  </span>
                ) : (
                  'File'
                )
              }
              actions={
                selected && (
                  <>
                    <span className='px-1.5 font-mono text-[11px] whitespace-nowrap text-muted-foreground'>
                      {filesize(selected.size, { base: 2 })} · {selected.mode} · {selected.uid}:{selected.gid}
                    </span>
                    {content && <CopyButton value={content} size='icon-sm' label='Copy file contents' />}
                    <Button variant='ghost' size='icon-sm' asChild>
                      <a
                        target='_blank'
                        rel='noreferrer'
                        aria-label='Download file'
                        title='Download'
                        href={downloadUrl(pulledRef, selected.id)}
                      >
                        <Download />
                      </a>
                    </Button>
                  </>
                )
              }
            >
              {selected == null ? (
                <p className='p-2.5 text-xs text-muted-foreground'>Select a file from the tree.</p>
              ) : fileError ? (
                <Alert className='m-2'>{fileError}</Alert>
              ) : !isReadable(selected.mime_type) ? (
                <p className='p-2.5 text-xs text-muted-foreground'>
                  Binary file ({selected.mime_type ?? 'unknown type'}) — use the download button. Downloading symlinked
                  files is not supported.
                </p>
              ) : (
                <CodeEditor onMount={(e) => (editorRef.current = e)} value={content} options={{ readOnly: true }} />
              )}
            </Panel>
          </Split>
        </>
      )}
    </Workspace>
  )
}

export default ImageBrowser
