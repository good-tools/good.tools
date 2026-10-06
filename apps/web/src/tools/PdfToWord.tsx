import { Download, ScanText, Trash2 } from 'lucide-react'
import { GlobalWorkerOptions, getDocument, OPS, PasswordResponses, type PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Fragment, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  type DocxImage,
  type PageImage,
  type PageInput,
  type Run,
  reconstruct,
  type TextItem,
  toDocx,
} from '@/lib/pdf-word'
import { downloadBlob } from '@/lib/utils'

GlobalWorkerOptions.workerSrc = workerUrl

interface Image extends PageImage, DocxImage {
  url: string
}

interface PageData extends PageInput {
  images: Image[]
  /** The whole page as an image, for pages without text */
  render?: Image
}

interface Result {
  name: string
  bytes: Uint8Array
  password: string
  pages: PageData[]
}

const APPROXIMATE =
  'You get the text, headings, lists and images as an editable Word document. The layout is approximate, not an exact copy of the page.'

/** Bumped per open and clear, so an earlier extraction or OCR run stops writing state. */
let generation = 0

const canvasOf = (width: number, height: number) =>
  Object.assign(document.createElement('canvas'), { width: Math.round(width), height: Math.round(height) })

async function encode(canvas: HTMLCanvasElement, rect: PageImage, alpha: boolean): Promise<Image> {
  const type = alpha ? 'png' : 'jpg'
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, alpha ? 'image/png' : 'image/jpeg', 0.9))
  if (!blob) throw new Error('Could not encode an image from this PDF')
  canvas.width = 0
  return { ...rect, type, bytes: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) }
}

interface ImgData {
  width: number
  height: number
  kind?: number
  data?: Uint8Array | Uint8ClampedArray
  bitmap?: ImageBitmap
}

/** pdf.js image data (1-bit grey, RGB or RGBA, or an ImageBitmap) on a canvas. */
function imageCanvas(img: ImgData): HTMLCanvasElement | null {
  const canvas = canvasOf(img.width, img.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0)
    return canvas
  }
  const src = img.data
  if (!src) return null
  const out = ctx.createImageData(img.width, img.height)
  const px = img.width * img.height
  if (img.kind === 3) out.data.set(src.subarray(0, px * 4))
  else if (img.kind === 2)
    for (let i = 0; i < px; i++) out.data.set([src[i * 3]!, src[i * 3 + 1]!, src[i * 3 + 2]!, 255], i * 4)
  else {
    const row = (img.width + 7) >> 3
    for (let i = 0; i < px; i++) {
      const x = i % img.width
      const v = (src[Math.floor(i / img.width) * row + (x >> 3)]! >> (7 - (x & 7))) & 1 ? 255 : 0
      out.data.set([v, v, v, 255], i * 4)
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

type Matrix = number[]
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0]! * n[0]! + m[2]! * n[1]!,
  m[1]! * n[0]! + m[3]! * n[1]!,
  m[0]! * n[2]! + m[2]! * n[3]!,
  m[1]! * n[2]! + m[3]! * n[3]!,
  m[0]! * n[4]! + m[2]! * n[5]! + m[4]!,
  m[1]! * n[4]! + m[3]! * n[5]! + m[5]!,
]

/** Text with font size and style, and the images painted on the page with where they land. */
async function readPage(page: PDFPageProxy): Promise<PageData> {
  const viewport = page.getViewport({ scale: 1 })
  const ops = await page.getOperatorList() // also loads the fonts and images we look up below
  const lookup = (id: string) => {
    try {
      return (id.startsWith('g_') ? page.commonObjs : page.objs).get(id)
    } catch {
      return null
    }
  }

  const items: TextItem[] = []
  for (const it of (await page.getTextContent()).items) {
    if (!('str' in it)) continue
    const [a, b, c, d, e, f] = it.transform as number[]
    const [x, y] = viewport.convertToViewportPoint(e!, f!)
    const font = lookup(it.fontName) as { bold?: boolean; black?: boolean; italic?: boolean } | null
    items.push({
      str: it.str,
      x: x!,
      y: y!,
      width: it.width,
      size: Math.hypot(c!, d!) || Math.hypot(a!, b!),
      bold: !!(font?.bold || font?.black),
      italic: !!font?.italic,
    })
  }

  const images: Image[] = []
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  const stack: Matrix[] = []
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i] as unknown[]
    if (fn === OPS.save || fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm)
      if (fn === OPS.paintFormXObjectBegin && Array.isArray(args[0])) ctm = multiply(ctm, args[0] as Matrix)
    } else if (fn === OPS.restore || fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm
    else if (fn === OPS.transform) ctm = multiply(ctm, args as Matrix)
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const img = (typeof args[0] === 'string' ? lookup(args[0]) : args[0]) as ImgData | null
      if (!img?.width || img.width < 16 || img.height < 16) continue
      // The image fills the unit square under the current transform
      const corners = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([u, v]) =>
        viewport.convertToViewportPoint(ctm[0]! * u! + ctm[2]! * v! + ctm[4]!, ctm[1]! * u! + ctm[3]! * v! + ctm[5]!),
      )
      const xs = corners.map((p) => p[0]!)
      const ys = corners.map((p) => p[1]!)
      const rect = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      }
      if (rect.width < 24 || rect.height < 24) continue
      const canvas = imageCanvas(img)
      if (canvas) images.push(await encode(canvas, rect, !!img.bitmap || img.kind === 3))
    }
  }

  const data: PageData = { width: viewport.width, height: viewport.height, items, images }
  if (!items.some((i) => i.str.trim())) {
    const scale = Math.min(150 / 72, 3000 / Math.max(viewport.width, viewport.height))
    const canvas = canvasOf(viewport.width * scale, viewport.height * scale)
    await page.render({ canvas, viewport: page.getViewport({ scale }) }).promise
    data.render = await encode(canvas, { x: 0, y: 0, width: viewport.width, height: viewport.height }, false)
  }
  page.cleanup()
  return data
}

function RunsView({ runs }: { runs: Run[] }) {
  return runs.map((r, i) => {
    const text = r.bold ? <strong>{r.text}</strong> : r.text
    return (
      <Fragment key={i}>
        {r.newLine && <br />}
        {r.italic ? <em>{text}</em> : text}
      </Fragment>
    )
  })
}

const headingClass = ['text-lg font-semibold', 'text-[15px] font-semibold', 'text-[13px] font-semibold']

function PdfToWord() {
  const [result, setResult] = useToolState<Result | null>('pdf-word:result', null)
  const [asImages, setAsImages] = useToolState('pdf-word:as-images', true)
  const [pending, setPending] = useState<{ name: string; bytes: Uint8Array } | null>(null)
  const [password, setPassword] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const open = async (name: string, bytes: Uint8Array, pw = '') => {
    const gen = ++generation
    setError('')
    setProgress('Opening…')
    // pdf.js transfers the buffer to its worker; keep ours for a retry with another password
    const task = getDocument({ data: bytes.slice(), password: pw })
    try {
      const doc = await task.promise
      const pages: PageData[] = []
      for (let n = 1; n <= doc.numPages; n++) {
        if (gen !== generation) return
        setProgress(`Reading page ${n} of ${doc.numPages}…`)
        pages.push(await readPage(await doc.getPage(n)))
      }
      if (gen !== generation) return
      setResult({ name, bytes, password: pw, pages })
      setPending(null)
      setPassword('')
    } catch (e) {
      if (gen !== generation) return
      if (e instanceof Error && e.name === 'PasswordException') {
        setPending({ name, bytes })
        setError(
          (e as Error & { code: number }).code === PasswordResponses.INCORRECT_PASSWORD
            ? 'Wrong password'
            : 'This PDF needs a password',
        )
      } else setError(e instanceof Error ? e.message : String(e))
    } finally {
      void task.destroy()
    }
    if (gen === generation) setProgress('')
  }

  const openFile = ([f]: File[]) => {
    if (f) void f.arrayBuffer().then((b) => open(f.name, new Uint8Array(b)))
  }

  const revoke = (r: Result | null) => {
    for (const p of r?.pages ?? []) for (const i of [...p.images, p.render]) if (i) URL.revokeObjectURL(i.url)
  }

  const clear = () => {
    generation++
    revoke(result)
    setResult(null)
    setPending(null)
    setError('')
    setProgress('')
  }

  const pages = useMemo(
    () =>
      result?.pages.map((p) => ({
        ...p,
        // A scanned or drawing-only page: the rendered page stands in for its pieces
        images: asImages && p.render ? [p.render] : p.images,
      })) ?? [],
    [result, asImages],
  )
  const blocks = useMemo(() => reconstruct(pages), [pages])
  const scanned = result ? result.pages.flatMap((p, i) => (p.render ? [i] : [])) : []

  /** Renders the pages without text at ~300 dpi and turns Tesseract's lines into text items. */
  const ocr = async () => {
    if (!result) return
    const gen = generation
    setError('')
    setProgress('Loading OCR engine…')
    let k = 0
    let worker: Awaited<ReturnType<typeof import('@/lib/ocr').createOcrWorker>> | undefined
    const task = getDocument({ data: result.bytes.slice(), password: result.password })
    try {
      const { createOcrWorker } = await import('@/lib/ocr') // ~7 MB; only fetched for scans
      worker = await createOcrWorker((p) =>
        setProgress(`OCR page ${k + 1} of ${scanned.length} · ${Math.round(p * 100)}%`),
      )
      const doc = await task.promise
      for (; k < scanned.length; k++) {
        const n = scanned[k]!
        const page = await doc.getPage(n + 1)
        const base = page.getViewport({ scale: 1 })
        const scale = Math.min(300 / 72, 4000 / Math.max(base.width, base.height))
        const canvas = canvasOf(base.width * scale, base.height * scale)
        await page.render({ canvas, viewport: page.getViewport({ scale }) }).promise
        const { data } = await worker.recognize(canvas, {}, { blocks: true })
        canvas.width = 0
        if (gen !== generation) return
        const items: TextItem[] = (data.blocks ?? []).flatMap((b) =>
          b.paragraphs.flatMap((p) =>
            p.lines.map(({ text, bbox }) => ({
              str: text.trim(),
              x: bbox.x0 / scale,
              y: bbox.y1 / scale,
              width: (bbox.x1 - bbox.x0) / scale,
              // Line box height is roughly the font size; whole points smooth over OCR jitter
              size: Math.round((bbox.y1 - bbox.y0) / scale),
            })),
          ),
        )
        setResult(
          (r) =>
            r && {
              ...r,
              pages: r.pages.map((p, i) => (i === n ? { ...p, items, images: [], render: undefined, ocr: true } : p)),
            },
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      void worker?.terminate()
      void task.destroy()
    }
    if (gen === generation) setProgress('')
  }

  const save = async () => {
    if (!result) return
    setError('')
    setProgress('Writing .docx…')
    try {
      const bytes = await toDocx(pages.map((p, i) => ({ ...p, blocks: blocks[i]! })))
      downloadBlob(
        bytes,
        `${result.name.replace(/\.pdf$/i, '')}.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setProgress('')
  }

  if (!result)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone className='py-5' accept='application/pdf,.pdf' onFiles={openFile} hint={APPROXIMATE}>
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

  const all = blocks.flat()
  const count = (kind: string, noun: string) => {
    const n = all.filter((b) => b.kind === kind).length
    return `${n} ${noun}${n === 1 ? '' : 's'}`
  }
  const busy = !!progress

  return (
    <DropTarget onFiles={openFile} label='Drop to open another PDF'>
      <Workspace
        toolbar={
          <>
            <Button size='sm' onClick={() => void save()} disabled={busy}>
              <Download /> Download .docx
            </Button>
            <Checkbox
              title='Pages without text as images'
              description='Put scanned or drawing-only pages in the document as one picture each'
              checked={asImages}
              onChange={(e) => setAsImages(e.target.checked)}
            />
            <FileButton
              size='sm'
              variant='ghost'
              accept='application/pdf,.pdf'
              disabled={busy}
              onFileSelected={(e) => openFile(Array.from(e.target.files ?? []))}
            >
              Open another
            </FileButton>
            <Button size='sm' variant='ghost' onClick={clear}>
              <Trash2 /> Clear
            </Button>
            {busy && <Spinner label={progress} />}
          </>
        }
      >
        <Alert variant='info'>{APPROXIMATE}</Alert>
        <Alert>{error}</Alert>
        {scanned.length > 0 && !busy && (
          <Alert variant='warning'>
            <div className='flex flex-wrap items-center gap-2'>
              {scanned.length === result.pages.length
                ? 'No text found. This looks like a scanned PDF.'
                : `${scanned.length} of ${result.pages.length} pages have no text (scanned?).`}
              <Button size='sm' variant='outline' onClick={() => void ocr()}>
                <ScanText /> Read with OCR
              </Button>
              <span className='text-xs text-muted-foreground'>
                English, runs in your browser; downloads about 7 MB the first time
              </span>
            </div>
          </Alert>
        )}
        <Panel
          title={`${result.name} · ${result.pages.length} ${result.pages.length === 1 ? 'page' : 'pages'}`}
          actions={
            <span className='px-1.5 text-xs text-muted-foreground'>
              {[
                count('heading', 'heading'),
                count('paragraph', 'paragraph'),
                count('list', 'list item'),
                count('image', 'image'),
              ].join(' · ')}
            </span>
          }
          className='flex-1'
        >
          <div className='flex flex-col gap-4 p-3 text-[13px] leading-relaxed'>
            {blocks.map((page, p) => (
              <section key={p} aria-label={`Page ${p + 1}`} className='flex flex-col gap-2'>
                <div className='flex items-center gap-2 font-mono text-[11px] text-muted-foreground'>
                  Page {p + 1}
                  {result.pages[p]?.ocr && ' · OCR'}
                  <span className='h-px flex-1 bg-border' />
                </div>
                {page.length === 0 && <p className='text-muted-foreground'>Empty page</p>}
                {page.map((b, i) => {
                  if (b.kind === 'image') {
                    const img = pages[p]!.images[b.index]!
                    return (
                      <img
                        key={i}
                        src={img.url}
                        alt={`Figure ${b.index + 1}, page ${p + 1}`}
                        className='max-h-48 max-w-full self-start border'
                      />
                    )
                  }
                  if (b.kind === 'heading') {
                    const H = (['h3', 'h4', 'h5'] as const)[b.level - 1]!
                    return (
                      <H key={i} className={headingClass[b.level - 1]}>
                        <RunsView runs={b.runs} />
                      </H>
                    )
                  }
                  if (b.kind === 'list')
                    return (
                      <p key={i} className='flex gap-2 pl-2'>
                        {!b.numbered && <span aria-hidden>•</span>}
                        <span>
                          <RunsView runs={b.runs} />
                        </span>
                      </p>
                    )
                  return (
                    <p key={i}>
                      <RunsView runs={b.runs} />
                    </p>
                  )
                })}
              </section>
            ))}
          </div>
        </Panel>
      </Workspace>
    </DropTarget>
  )
}

export default PdfToWord
