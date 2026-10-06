import { Check, Download, Square, SquareCheck, Trash2, X } from 'lucide-react'
import { GlobalWorkerOptions, getDocument, PasswordResponses } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { IMAGE_FORMATS, type ImageFormat, imageName, renderSize, zipFiles } from '@/lib/pdf-images'
import { cn, downloadBlob } from '@/lib/utils'

GlobalWorkerOptions.workerSrc = workerUrl

interface Doc {
  name: string
  bytes: Uint8Array
  password: string
  count: number
}

interface Options {
  format: ImageFormat
  dpi: number
  /** 1–100, for JPG and WebP */
  quality: number
}

const DPIS = [72, 96, 150, 200, 300, 600]

/** Bumped per open, clear and cancel, so earlier thumbnails or exports stop writing state. */
let generation = 0

/**
 * Renders pages (0-based) one at a time with pdf.js, which parses in its own worker and draws in small slices,
 * so the page stays responsive. Stops early when `gen` is no longer current.
 */
async function renderPages(
  doc: Doc,
  which: number[],
  gen: number,
  draw: (canvas: HTMLCanvasElement, index: number) => Promise<void>,
  size: (width: number, height: number) => number,
) {
  // pdf.js transfers the buffer to its worker; keep ours
  const task = getDocument({ data: doc.bytes.slice(), password: doc.password })
  try {
    const pdf = await task.promise
    for (const index of which) {
      if (gen !== generation) return
      const page = await pdf.getPage(index + 1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: size(base.width, base.height) })
      const canvas = Object.assign(document.createElement('canvas'), {
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
      })
      await page.render({ canvas, viewport }).promise
      page.cleanup()
      if (gen === generation) await draw(canvas, index)
      canvas.width = 0 // frees the bitmap now rather than at GC
    }
  } finally {
    void task.destroy()
  }
}

const toBlob = (canvas: HTMLCanvasElement, { format, quality }: Options) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('This page is too large for your browser to encode'))),
      IMAGE_FORMATS[format].mime,
      quality / 100,
    ),
  )

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')
const inlineLabel = 'flex items-center gap-1.5 text-xs text-muted-foreground'

function PdfToImages() {
  const [doc, setDoc] = useToolState<Doc | null>('pdf-images:doc', null)
  const [thumbs, setThumbs] = useToolState<string[]>('pdf-images:thumbs', [])
  const [selected, setSelected] = useToolState<boolean[]>('pdf-images:selected', [])
  const [format, setFormat] = useToolState<ImageFormat>('pdf-images:format', 'jpg')
  const [dpi, setDpi] = useToolState('pdf-images:dpi', 150)
  const [quality, setQuality] = useToolState('pdf-images:quality', 90)
  const [pending, setPending] = useState<{ name: string; bytes: Uint8Array } | null>(null)
  const [password, setPassword] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const renderThumbs = (d: Doc, which: number[], gen: number) =>
    renderPages(
      d,
      which,
      gen,
      async (canvas, i) => {
        const url = canvas.toDataURL('image/jpeg', 0.8) // now: the canvas is freed right after
        setThumbs((t) => {
          const copy = [...t]
          copy[i] = url
          return copy
        })
      },
      (w, h) => 320 / Math.max(w, h),
    )

  const open = async (name: string, bytes: Uint8Array, pw = '') => {
    const gen = ++generation
    setError('')
    setProgress('Opening…')
    try {
      const task = getDocument({ data: bytes.slice(), password: pw })
      const count = await task.promise.then((d) => d.numPages).finally(() => void task.destroy())
      if (gen !== generation) return
      const next = { name, bytes, password: pw, count }
      setDoc(next)
      setSelected(Array(count).fill(true))
      setThumbs([])
      setPending(null)
      setPassword('')
      setProgress('')
      await renderThumbs(next, [...Array(count).keys()], gen)
    } catch (e) {
      if (gen !== generation) return
      setProgress('')
      if (e instanceof Error && e.name === 'PasswordException') {
        setPending({ name, bytes })
        setError(
          (e as Error & { code: number }).code === PasswordResponses.INCORRECT_PASSWORD
            ? 'Wrong password'
            : 'This PDF needs a password',
        )
      } else setError(e instanceof Error ? e.message : String(e))
    }
  }

  const openFile = ([f]: File[]) => {
    if (f) void f.arrayBuffer().then((b) => open(f.name, new Uint8Array(b)))
  }

  /** One page downloads as an image, several as a zip. */
  const save = async (which: number[]) => {
    if (!doc || !which.length) return
    const gen = ++generation // also stops thumbnails still rendering; they resume below
    const options = { format, dpi, quality }
    const files: [string, Uint8Array][] = []
    setError('')
    try {
      await renderPages(
        doc,
        which,
        gen,
        async (canvas, index) => {
          setProgress(`Rendering page ${index + 1} · ${files.length + 1} of ${which.length}`)
          const blob = await toBlob(canvas, options)
          files.push([imageName(doc.name, index + 1, doc.count, format), new Uint8Array(await blob.arrayBuffer())])
        },
        (w, h) => renderSize(w, h, dpi).scale,
      )
      if (gen !== generation) return // cancelled
      if (files.length === 1) downloadBlob(files[0]![1], files[0]![0], IMAGE_FORMATS[format].mime)
      else {
        setProgress('Zipping…')
        downloadBlob(zipFiles(files), `${doc.name.replace(/\.pdf$/i, '')}-${format}.zip`, 'application/zip')
      }
    } catch (e) {
      if (gen === generation) setError(e instanceof Error ? e.message : String(e))
    }
    if (gen !== generation) return
    setProgress('')
    // Finish any thumbnails the export interrupted
    const missing = [...Array(doc.count).keys()].filter((i) => !thumbs[i])
    if (missing.length) void renderThumbs(doc, missing, gen)
  }

  const clear = () => {
    generation++
    setDoc(null)
    setThumbs([])
    setSelected([])
    setPending(null)
    setError('')
    setProgress('')
  }

  if (!doc)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone className='py-5' accept='application/pdf,.pdf' onFiles={openFile} hint='Rendered locally with pdf.js'>
          Drop a PDF here or click to browse
        </DropZone>
        {pending && (
          <form
            className='flex max-w-sm items-center gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              void open(pending.name, pending.bytes, password)
            }}
          >
            <Input
              type='password'
              aria-label='PDF password'
              placeholder={`Password for ${pending.name}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <Button type='submit' size='sm' disabled={!!progress}>
              Open
            </Button>
          </form>
        )}
        {progress && <Spinner label={progress} />}
        <Alert>{error}</Alert>
      </div>
    )

  const chosen = selected.flatMap((s, i) => (s ? [i] : []))
  const busy = !!progress
  const page = renderSize(612, 792, dpi) // US Letter, for the size hint

  return (
    <DropTarget onFiles={openFile} label='Drop to open another PDF'>
      <Workspace
        toolbar={
          <>
            <Button size='sm' onClick={() => void save(chosen)} disabled={busy || !chosen.length}>
              <Download />
              {chosen.length === 1 ? 'Download page' : `Download ${chosen.length} pages (.zip)`}
            </Button>
            <Segmented
              label='Image format'
              value={format}
              onChange={setFormat}
              options={Object.entries(IMAGE_FORMATS).map(([v, f]) => [v as ImageFormat, f.label])}
            />
            <select
              aria-label='Resolution'
              title={`A Letter page at ${dpi} dpi is ${page.width}×${page.height} px`}
              className={selectClass}
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
            >
              {DPIS.map((d) => (
                <option key={d} value={d}>
                  {d} dpi{d === 72 ? ' (1×)' : d === 150 ? ' (screen)' : d === 300 ? ' (print)' : ''}
                </option>
              ))}
            </select>
            {IMAGE_FORMATS[format].lossy && (
              <label className={inlineLabel}>
                Quality
                <Input
                  type='number'
                  min={1}
                  max={100}
                  className='h-7 w-16 text-xs'
                  value={quality}
                  onChange={(e) => setQuality(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                />
              </label>
            )}
            <Button
              size='sm'
              variant='ghost'
              onClick={() => setSelected(Array(doc.count).fill(chosen.length < doc.count))}
            >
              {chosen.length < doc.count ? <SquareCheck /> : <Square />}
              {chosen.length < doc.count ? 'Select all' : 'Select none'}
            </Button>
            <FileButton
              size='sm'
              variant='ghost'
              accept='application/pdf,.pdf'
              onFileSelected={(e) => openFile(Array.from(e.target.files ?? []))}
            >
              Open another
            </FileButton>
            <Button size='sm' variant='ghost' onClick={clear}>
              <Trash2 /> Clear
            </Button>
            {busy && (
              <>
                <Spinner label={progress} />
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => {
                    generation++
                    setProgress('')
                  }}
                >
                  <X /> Cancel
                </Button>
              </>
            )}
          </>
        }
      >
        <Alert>{error}</Alert>
        <Panel
          title={`${doc.name} · ${chosen.length} of ${doc.count} pages selected`}
          actions={<span className='px-1.5 text-xs text-muted-foreground'>Click a page to select it</span>}
          className='flex-1'
        >
          <ol className='grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2 p-2'>
            {selected.map((on, i) => (
              <li
                key={i}
                className={cn(
                  'flex flex-col gap-1 rounded-md border bg-background p-1.5',
                  on && 'border-foreground/50 bg-accent',
                )}
              >
                <button
                  type='button'
                  aria-pressed={on}
                  aria-label={`Select page ${i + 1}`}
                  onClick={() => setSelected((s) => s.map((v, j) => (j === i ? !v : v)))}
                  className='relative flex aspect-square items-center justify-center overflow-hidden rounded-sm bg-muted/50'
                >
                  {thumbs[i] ? (
                    <img
                      src={thumbs[i]}
                      alt={`Page ${i + 1}`}
                      className={cn('max-h-full max-w-full border shadow-xs', !on && 'opacity-50')}
                    />
                  ) : (
                    <Spinner />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-1 right-1 flex size-4 items-center justify-center rounded-sm border bg-background',
                      on && 'border-foreground bg-foreground text-background',
                    )}
                  >
                    {on && <Check className='size-3' />}
                  </span>
                </button>
                <div className='flex items-center justify-between'>
                  <span className='px-1 font-mono text-[11px] text-muted-foreground'>{i + 1}</span>
                  <Button
                    size='icon-sm'
                    variant='ghost'
                    aria-label={`Download page ${i + 1}`}
                    disabled={busy}
                    onClick={() => void save([i])}
                  >
                    <Download />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </Workspace>
    </DropTarget>
  )
}

export default PdfToImages
