import { filesize } from 'filesize'
import { Download, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { SortableList } from '@/components/ui/sortable-list'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { mergePdfs, openPdf } from '@/lib/pdf'
import { downloadBlob } from '@/lib/utils'

interface Item {
  id: string
  name: string
  bytes: Uint8Array
  pages?: number
  error?: string
}

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

async function read(file: File): Promise<Item> {
  const item = { id: crypto.randomUUID(), name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
  try {
    return { ...item, pages: (await openPdf(item.bytes)).getPageCount() }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ...item,
      error: e instanceof Error && e.name === 'PasswordError' ? `${message}; unlock it first` : message,
    }
  }
}

function MergePdf() {
  const [items, setItems] = useToolState<Item[]>('merge-pdf:items', [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (files: File[]) => {
    setError('')
    const pdfs = files.filter(isPdf)
    if (pdfs.length < files.length) setError('Skipped files that are not PDFs')
    setBusy(true)
    const added = await Promise.all(pdfs.map(read))
    setItems((prev) => [...prev, ...added])
    setBusy(false)
  }

  const merge = async () => {
    setBusy(true)
    setError('')
    try {
      downloadBlob(await mergePdfs(items.map((i) => i.bytes)), 'merged.pdf', 'application/pdf')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const pages = items.reduce((n, i) => n + (i.pages ?? 0), 0)
  const blocked = items.some((i) => i.error)

  if (!items.length)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone className='py-5' multiple accept='application/pdf,.pdf' onFiles={(f) => void add(f)}>
          Drop PDFs here or click to browse
        </DropZone>
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={() => void merge()} disabled={busy || blocked || items.length < 2}>
            <Download /> Merge &amp; download
          </Button>
          <FileButton
            size='sm'
            accept='application/pdf,.pdf'
            multiple
            onFileSelected={(e) => void add(Array.from(e.target.files ?? []))}
          >
            <Plus /> Add PDFs
          </FileButton>
          <Button size='sm' variant='ghost' onClick={() => setItems([])}>
            <Trash2 /> Clear
          </Button>
          {busy && <Spinner />}
        </>
      }
    >
      <Alert>{error}</Alert>
      <Panel
        title={`${items.length} files · ${pages} pages`}
        actions={<span className='px-1.5 text-xs text-muted-foreground'>Drag or use the arrows to reorder</span>}
      >
        <SortableList items={items} onChange={setItems}>
          {(item) => (
            <>
              <span className='min-w-0 truncate' title={item.name}>
                {item.name}
              </span>
              {item.error ? (
                <span className='truncate text-xs text-destructive'>{item.error}</span>
              ) : (
                <span className='shrink-0 text-xs text-muted-foreground'>
                  {item.pages} {item.pages === 1 ? 'page' : 'pages'} · {filesize(item.bytes.byteLength, { base: 2 })}
                </span>
              )}
            </>
          )}
        </SortableList>
      </Panel>
    </Workspace>
  )
}

export default MergePdf
