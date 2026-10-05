import { filesize } from 'filesize'
import { Download, LockOpen, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Input } from '@/components/ui/input'
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
  /** Needs its open password before it can be merged */
  locked?: boolean
  error?: string
}

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

async function inspect(item: Item): Promise<Item> {
  try {
    return { ...item, pages: (await openPdf(item.bytes)).getPageCount(), locked: false, error: undefined }
  } catch (e) {
    if (e instanceof Error && e.name === 'PasswordError') return { ...item, locked: true }
    return { ...item, error: e instanceof Error ? e.message : String(e) }
  }
}

const read = async (file: File) =>
  inspect({ id: crypto.randomUUID(), name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })

/** Decrypts with qpdf (loaded only when needed) so the merged file carries no encryption. */
async function unlock(item: Item, password: string): Promise<Item> {
  const { unlockPdf } = await import('@/lib/qpdf')
  try {
    return inspect({ ...item, bytes: await unlockPdf(item.bytes, password) })
  } catch (e) {
    return { ...item, error: e instanceof Error ? e.message : String(e) }
  }
}

function UnlockForm({ item, onUnlock }: { item: Item; onUnlock: (password: string) => void }) {
  const [password, setPassword] = useState('')
  return (
    <form
      className='flex min-w-0 items-center gap-1'
      onSubmit={(e) => {
        e.preventDefault()
        onUnlock(password)
      }}
    >
      <Input
        type='password'
        aria-label={`Password for ${item.name}`}
        placeholder='Password'
        className='h-7 w-36 text-xs'
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type='submit' size='sm' variant='outline'>
        <LockOpen /> Unlock
      </Button>
      {item.error && <span className='truncate text-xs text-destructive'>{item.error}</span>}
    </form>
  )
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

  const unlockItem = async (item: Item, password: string) => {
    const next = await unlock(item, password)
    setItems((prev) => prev.map((i) => (i.id === item.id ? next : i)))
  }

  const pages = items.reduce((n, i) => n + (i.pages ?? 0), 0)
  const blocked = items.some((i) => i.error || i.locked)

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
              {item.locked ? (
                <UnlockForm item={item} onUnlock={(pw) => void unlockItem(item, pw)} />
              ) : item.error ? (
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
