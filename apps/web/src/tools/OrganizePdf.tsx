import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileOutput,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Input } from '@/components/ui/input'
import { move } from '@/components/ui/sortable-list'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { openPdf, organizePdf, type PageEdit, parsePageRange, renamePdf } from '@/lib/pdf'
import { renderPages } from '@/lib/pdf-render'
import { cn, downloadBlob } from '@/lib/utils'

interface Page extends PageEdit {
  id: string
}

interface Doc {
  name: string
  bytes: Uint8Array
  count: number
}

const pagesOf = (count: number): Page[] =>
  Array.from({ length: count }, (_, index) => ({ id: crypto.randomUUID(), index, rotation: 0 }))

/** Bumped per open and clear, so a slower earlier open (or its thumbnails) stops writing state. */
let generation = 0

function OrganizePdf() {
  const [doc, setDoc] = useToolState<Doc | null>('organize-pdf:doc', null)
  const [pages, setPages] = useToolState<Page[]>('organize-pdf:pages', [])
  const [thumbs, setThumbs] = useToolState<string[]>('organize-pdf:thumbs', [])
  const [range, setRange] = useToolState('organize-pdf:range', '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragged, setDragged] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const open = async ([file]: File[]) => {
    if (!file) return
    const gen = ++generation
    setError('')
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const count = (await openPdf(bytes)).getPageCount()
      if (gen !== generation) return
      setDoc({ name: file.name, bytes, count })
      setPages(pagesOf(count))
      setThumbs([])
      setBusy(false)
      await renderPages(
        bytes,
        320,
        (i, url) =>
          setThumbs((t) => {
            const next = [...t]
            next[i] = url
            return next
          }),
        () => gen === generation,
      )
    } catch (e) {
      if (gen !== generation) return
      const msg = e instanceof Error ? e.message : String(e)
      setError(
        e instanceof Error && e.name === 'PasswordError' ? `${msg}. Remove it with Protect / Unlock PDF first.` : msg,
      )
      setBusy(false)
    }
  }

  /** Builds PDFs one after another and downloads each. */
  const save = async (files: [name: string, pages: Page[]][]) => {
    if (!doc) return
    setBusy(true)
    setError('')
    try {
      const src = await openPdf(doc.bytes) // parsed once, even for a split into hundreds of files
      for (const [name, which] of files) {
        downloadBlob(await organizePdf(src, which), name, 'application/pdf')
        // Browsers drop downloads that start in the same instant
        if (files.length > 1) await new Promise((r) => setTimeout(r, 200))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const extract = () => {
    if (!doc) return
    try {
      const which = parsePageRange(range, pages.length).map((i) => pages[i]!)
      void save([[renamePdf(doc.name, `pages-${range.replace(/\s+/g, '')}`), which]])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const rotate = (by: number, id?: string) =>
    setPages((ps) => ps.map((p) => (id === undefined || p.id === id ? { ...p, rotation: p.rotation + by } : p)))

  const clear = () => {
    generation++
    setDoc(null)
    setPages([])
    setThumbs([])
    setError('')
    setBusy(false)
  }

  if (!doc)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone className='py-5' accept='application/pdf,.pdf' onFiles={(f) => void open(f)}>
          Drop a PDF here or click to browse
        </DropZone>
        {busy && <Spinner label='Opening…' />}
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <DropTarget onFiles={(f) => void open(f)} label='Drop to open another PDF'>
      <Workspace
        toolbar={
          <>
            <Button
              size='sm'
              onClick={() => void save([[renamePdf(doc.name, 'organized'), pages]])}
              disabled={busy || !pages.length}
            >
              <Download /> Save PDF
            </Button>
            <Button size='sm' variant='outline' onClick={() => rotate(-90)} disabled={!pages.length}>
              <RotateCcw /> Rotate all left
            </Button>
            <Button size='sm' variant='outline' onClick={() => rotate(90)} disabled={!pages.length}>
              <RotateCw /> Rotate all right
            </Button>
            <form
              className='flex items-center gap-1'
              onSubmit={(e) => {
                e.preventDefault()
                extract()
              }}
            >
              <Input
                aria-label='Pages to extract'
                placeholder='1-3, 7'
                className='h-7 w-28 text-xs'
                value={range}
                onChange={(e) => setRange(e.target.value)}
              />
              <Button type='submit' size='sm' variant='outline' disabled={busy || !range.trim()}>
                <FileOutput /> Extract
              </Button>
            </form>
            <Button
              size='sm'
              variant='outline'
              onClick={() => void save(pages.map((p, i) => [renamePdf(doc.name, String(i + 1)), [p]]))}
              disabled={busy || pages.length < 2}
            >
              <Scissors /> Split into pages
            </Button>
            <FileButton
              size='sm'
              variant='ghost'
              accept='application/pdf,.pdf'
              onFileSelected={(e) => void open(Array.from(e.target.files ?? []))}
            >
              Open another
            </FileButton>
            <Button size='sm' variant='ghost' onClick={() => setPages(pagesOf(doc.count))}>
              <Undo2 /> Reset
            </Button>
            <Button size='sm' variant='ghost' onClick={clear}>
              <Trash2 /> Clear
            </Button>
            {busy && <Spinner />}
          </>
        }
      >
        <Alert>{error}</Alert>
        <Panel
          title={`${doc.name} · ${pages.length} of ${doc.count} pages`}
          actions={<span className='px-1.5 text-xs text-muted-foreground'>Drag or use the arrows to reorder</span>}
          className='flex-1'
        >
          <ol className='grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 p-2'>
            {pages.map((p, i) => {
              const label = `page ${i + 1}`
              return (
                <li
                  key={p.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    setDragged(i)
                  }}
                  onDragOver={(e) => {
                    if (dragged === null) return // a file from outside; let the drop target have it
                    e.preventDefault()
                    setOver(i)
                  }}
                  onDrop={(e) => {
                    if (dragged === null) return
                    e.preventDefault()
                    e.stopPropagation()
                    if (dragged !== i) setPages(move(pages, dragged, i))
                  }}
                  onDragEnd={() => {
                    setDragged(null)
                    setOver(null)
                  }}
                  className={cn(
                    'flex cursor-grab flex-col gap-1 rounded-md border bg-background p-1.5',
                    dragged === i && 'opacity-40',
                    over === i && dragged !== i && 'border-foreground/50 bg-accent',
                  )}
                >
                  <div className='relative flex aspect-square items-center justify-center overflow-hidden rounded-sm bg-muted/50'>
                    {thumbs[p.index] ? (
                      <img
                        src={thumbs[p.index]}
                        alt={`Page ${p.index + 1} of the original`}
                        draggable={false}
                        className='max-h-full max-w-full border shadow-xs transition-transform'
                        style={{ transform: `rotate(${p.rotation}deg)` }}
                      />
                    ) : (
                      <Spinner />
                    )}
                    <span className='absolute bottom-1 left-1 rounded-sm border bg-background px-1 font-mono text-[11px]'>
                      {i + 1}
                      {p.index !== i && <span className='text-muted-foreground'> · was {p.index + 1}</span>}
                    </span>
                  </div>
                  <div className='flex items-center justify-end gap-0.5'>
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label={`Move ${label} earlier`}
                      disabled={i === 0}
                      onClick={() => setPages(move(pages, i, i - 1))}
                    >
                      <ArrowLeft />
                    </Button>
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label={`Move ${label} later`}
                      disabled={i === pages.length - 1}
                      onClick={() => setPages(move(pages, i, i + 1))}
                    >
                      <ArrowRight />
                    </Button>
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label={`Rotate ${label} left`}
                      onClick={() => rotate(-90, p.id)}
                    >
                      <RotateCcw />
                    </Button>
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label={`Rotate ${label} right`}
                      onClick={() => rotate(90, p.id)}
                    >
                      <RotateCw />
                    </Button>
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label={`Delete ${label}`}
                      onClick={() => setPages(pages.filter((x) => x.id !== p.id))}
                    >
                      <X />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
        </Panel>
      </Workspace>
    </DropTarget>
  )
}

export default OrganizePdf
