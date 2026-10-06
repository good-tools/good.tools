import { Download, ImagePlus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Input, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  BASELINE,
  editPdf,
  FONTS,
  type FontKey,
  HIGHLIGHT,
  type Item,
  LINE_HEIGHT,
  moveBox,
  NUMBER_MARGIN,
  type NumberPosition,
  type PageNumbers,
  pageLabel,
  resizeBox,
  type Watermark,
} from '@/lib/edit-pdf'
import { openPdf, renamePdf } from '@/lib/pdf'
import { type RenderedPage, renderPages } from '@/lib/pdf-render'
import { cn, downloadBlob } from '@/lib/utils'

interface Doc {
  name: string
  bytes: Uint8Array
  count: number
}

type Mode = 'select' | 'text' | 'whiteout' | 'highlight' | 'image'

interface PendingImage {
  bytes: Uint8Array
  format: 'png' | 'jpeg'
  url: string
  width: number
  height: number
}

/** Shown until a page has rendered */
const A4 = { width: 595.28, height: 841.89 }

/** Bumped per open and clear, so a slower earlier open (or its rendering) stops writing state. */
let generation = 0

/** Re-encodes through a canvas so the PDF gets what the browser shows (EXIF orientation). PNG keeps its alpha. */
async function readImage(file: File): Promise<PendingImage> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const format = file.type === 'image/png' ? 'png' : 'jpeg'
  if (format === 'jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), `image/${format}`, 0.92),
  )
  return { bytes: new Uint8Array(await blob.arrayBuffer()), format, url: URL.createObjectURL(blob), width, height }
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`
/** Font size that scales with the page preview (its width is 100cqw) */
const cq = (pt: number, pageWidth: number) => `${(pt / pageWidth) * 100}cqw`

const DEFAULT_WATERMARK: Watermark = {
  enabled: false,
  text: 'CONFIDENTIAL',
  size: 60,
  opacity: 0.2,
  rotation: 45,
  color: '#ff0000',
}
const DEFAULT_NUMBERS: PageNumbers = {
  enabled: false,
  format: 'Page {n} of {total}',
  start: 1,
  position: 'bottom-center',
  size: 10,
}

/** One page: the pdf.js render with the items over it. Click to place, drag to move, corner to resize. */
function PageView({
  index,
  count,
  page,
  items,
  selected,
  mode,
  watermark,
  numbers,
  onSelect,
  onPlace,
  onChange,
  onDelete,
}: {
  index: number
  count: number
  page: RenderedPage | undefined
  items: Item[]
  selected: string | null
  mode: Mode
  watermark: Watermark
  numbers: PageNumbers
  onSelect: (id: string | null) => void
  /** Click on the page in a placing mode, at (x, y) points from the top-left */
  onPlace: (x: number, y: number) => void
  onChange: (item: Item) => void
  onDelete: (id: string) => void
}) {
  const size = page ?? A4
  const ptPerPx = (el: Element) => size.width / el.getBoundingClientRect().width

  const drag = (e: React.PointerEvent<HTMLElement>, item: Item, how: 'move' | 'resize') => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onSelect(item.id)
    const target = e.currentTarget
    const scale = ptPerPx(target.closest('[data-page]') ?? target)
    target.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - e.clientX) * scale
      const dy = (ev.clientY - e.clientY) * scale
      onChange(how === 'move' ? moveBox(item, dx, dy, size) : resizeBox(item, dx, dy, size, item.kind === 'image'))
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  const keys = (e: React.KeyboardEvent, item: Item) => {
    const step = e.shiftKey ? 10 : 1
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const m = moves[e.key]
    if (m) onChange(moveBox(item, m[0], m[1], size))
    else if (e.key === 'Delete' || e.key === 'Backspace') onDelete(item.id)
    else return
    e.preventDefault()
  }

  const [vPos, hPos] = numbers.position.split('-')

  return (
    <div
      data-page
      role='group'
      aria-label={`Page ${index + 1}`}
      className={cn(
        'relative w-full max-w-3xl touch-none overflow-hidden border bg-white shadow-sm select-none',
        mode !== 'select' && 'cursor-crosshair',
      )}
      style={{ aspectRatio: `${size.width} / ${size.height}`, containerType: 'inline-size' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const r = e.currentTarget.getBoundingClientRect()
        const s = size.width / r.width
        if (mode === 'select') onSelect(null)
        else onPlace((e.clientX - r.left) * s, (e.clientY - r.top) * s)
      }}
    >
      {page ? (
        <img src={page.url} alt='' draggable={false} className='pointer-events-none size-full' />
      ) : (
        <div className='flex size-full items-center justify-center'>
          <Spinner />
        </div>
      )}
      {watermark.enabled && (
        <span
          aria-hidden
          className='pointer-events-none absolute top-1/2 left-1/2 font-bold whitespace-pre'
          style={{
            fontFamily: FONTS.helvetica.css,
            fontSize: cq(watermark.size, size.width),
            lineHeight: LINE_HEIGHT,
            color: watermark.color,
            opacity: watermark.opacity,
            transform: `translate(-50%, -50%) rotate(${-watermark.rotation}deg)`,
          }}
        >
          {watermark.text}
        </span>
      )}
      {numbers.enabled && (
        <span
          aria-hidden
          className='pointer-events-none absolute whitespace-pre text-black'
          style={{
            fontFamily: FONTS.helvetica.css,
            fontSize: cq(numbers.size, size.width),
            lineHeight: LINE_HEIGHT,
            top: pct(
              (vPos === 'top' ? NUMBER_MARGIN + numbers.size * 0.7 : size.height - NUMBER_MARGIN) -
                numbers.size * BASELINE,
              size.height,
            ),
            left: hPos === 'left' ? pct(NUMBER_MARGIN, size.width) : hPos === 'center' ? '50%' : undefined,
            right: hPos === 'right' ? pct(NUMBER_MARGIN, size.width) : undefined,
            transform: hPos === 'center' ? 'translateX(-50%)' : undefined,
          }}
        >
          {pageLabel(numbers.format, index, count, numbers.start)}
        </span>
      )}
      {items.map((item) => {
        const isText = item.kind === 'text'
        return (
          <button
            key={item.id}
            type='button'
            aria-label={`${item.kind === 'text' ? `Text "${item.text}"` : item.kind}: drag or use arrow keys to move (Shift for 10 pt), Delete to remove`}
            aria-pressed={selected === item.id}
            className={cn(
              'group absolute cursor-move text-left outline-offset-1 hover:outline hover:outline-black/40 focus-visible:outline-2 focus-visible:outline-black',
              selected === item.id && 'outline outline-1 outline-black',
              item.kind === 'whiteout' && 'bg-white outline-dashed outline-1 outline-black/30',
              item.kind === 'highlight' && 'mix-blend-multiply',
            )}
            style={{
              left: pct(item.x, size.width),
              top: pct(item.y, size.height),
              ...(isText
                ? {
                    fontFamily: FONTS[item.font].css,
                    fontWeight: item.font === 'helvetica-bold' ? 'bold' : undefined,
                    fontSize: cq(item.size, size.width),
                    lineHeight: LINE_HEIGHT,
                    color: item.color,
                    whiteSpace: 'pre',
                  }
                : { width: pct(item.width, size.width), height: pct(item.height, size.height) }),
              background: item.kind === 'highlight' ? HIGHLIGHT : undefined,
            }}
            onPointerDown={(e) => drag(e, item, 'move')}
            onKeyDown={(e) => keys(e, item)}
            onFocus={() => onSelect(item.id)}
          >
            {item.kind === 'text' && (item.text || ' ')}
            {item.kind === 'image' && <img src={item.url} alt='' draggable={false} className='size-full' />}
            {!isText && (
              <span
                aria-hidden
                className='absolute -right-1 -bottom-1 hidden size-2.5 cursor-nwse-resize border border-white bg-black group-hover:block group-focus-visible:block'
                onPointerDown={(e) => drag(e, item, 'resize')}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')
const row = 'flex items-center gap-1.5 text-xs text-muted-foreground'
const numberClass = 'h-7 w-16 text-xs'

function EditPdf() {
  const [doc, setDoc] = useToolState<Doc | null>('edit-pdf:doc', null)
  const [pages, setPages] = useToolState<RenderedPage[]>('edit-pdf:pages', [])
  const [items, setItems] = useToolState<Item[]>('edit-pdf:items', [])
  const [watermark, setWatermark] = useToolState('edit-pdf:watermark', DEFAULT_WATERMARK)
  const [numbers, setNumbers] = useToolState('edit-pdf:numbers', DEFAULT_NUMBERS)
  const [mode, setMode] = useState<Mode>('select')
  const [pending, setPending] = useState<PendingImage | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      setPages([])
      setItems([])
      setSelected(null)
      setBusy(false)
      await renderPages(
        bytes,
        1400,
        (i, p) =>
          setPages((ps) => {
            const next = [...ps]
            next[i] = p
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

  const pickImage = async ([file]: File[]) => {
    if (!file) return
    try {
      setPending(await readImage(file))
      setMode('image')
    } catch {
      setError(`Could not read ${file.name}. Use JPEG, PNG, WebP or GIF.`)
    }
  }

  const place = (page: number, x: number, y: number) => {
    const size = pages[page] ?? A4
    const id = crypto.randomUUID()
    const at = { id, page, x, y, width: 0, height: 0 }
    let item: Item
    if (mode === 'text') item = { ...at, kind: 'text', text: 'Text', size: 14, color: '#000000', font: 'helvetica' }
    else if (mode === 'image' && pending) {
      // 96 dpi, at most half the page wide
      const width = Math.min(pending.width * 0.75, size.width / 2)
      item = { ...at, kind: 'image', ...pending, width, height: (width * pending.height) / pending.width }
      setPending(null)
    } else if (mode === 'whiteout' || mode === 'highlight')
      item = { ...at, kind: mode, width: 120, height: mode === 'highlight' ? 16 : 30 }
    else return
    setItems([...items, moveBox(item, 0, 0, size)])
    setSelected(id)
    setMode('select')
  }

  const change = (item: Item) => setItems((its) => its.map((i) => (i.id === item.id ? item : i)))
  const remove = (id: string) => {
    setItems((its) => its.filter((i) => i.id !== id))
    setSelected(null)
  }

  const download = async () => {
    if (!doc) return
    setBusy(true)
    setError('')
    try {
      downloadBlob(
        await editPdf(doc.bytes, items, watermark, numbers),
        renamePdf(doc.name, 'edited'),
        'application/pdf',
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Standard PDF fonts only cover Latin (WinAnsi) characters
      setError(/cannot encode/i.test(msg) ? `${msg}. The standard PDF fonts only cover Latin text.` : msg)
    }
    setBusy(false)
  }

  const clear = () => {
    generation++
    setDoc(null)
    setPages([])
    setItems([])
    setSelected(null)
    setError('')
    setBusy(false)
  }

  if (!doc)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          accept='application/pdf,.pdf'
          onFiles={(f) => void open(f)}
          hint='Add text, images, white-out, highlights, a watermark or page numbers. Nothing is uploaded.'
        >
          Drop a PDF here or click to browse
        </DropZone>
        {busy && <Spinner label='Opening…' />}
        <Alert>{error}</Alert>
      </div>
    )

  const sel = items.find((i) => i.id === selected)
  const hint =
    mode === 'select'
      ? 'Pick a tool, then click a page'
      : mode === 'image'
        ? 'Click a page to place the image'
        : `Click a page to add ${mode === 'text' ? 'text' : `a ${mode} box`}`

  return (
    <DropTarget onFiles={(f) => void open(f)} label='Drop to open another PDF'>
      <Workspace
        toolbar={
          <>
            <Button size='sm' onClick={() => void download()} disabled={busy}>
              <Download /> Download PDF
            </Button>
            <Segmented
              label='Tool'
              value={mode === 'image' ? 'select' : mode}
              onChange={(m) => {
                setMode(m)
                setPending(null)
              }}
              options={[
                ['select', 'Select'],
                ['text', 'Text'],
                ['whiteout', 'White-out'],
                ['highlight', 'Highlight'],
              ]}
            />
            <FileButton
              size='sm'
              variant={mode === 'image' ? 'default' : 'outline'}
              accept='image/*'
              onFileSelected={(e) => void pickImage(Array.from(e.target.files ?? []))}
            >
              <ImagePlus /> Image
            </FileButton>
            <FileButton
              size='sm'
              variant='ghost'
              accept='application/pdf,.pdf'
              onFileSelected={(e) => void open(Array.from(e.target.files ?? []))}
            >
              Open another
            </FileButton>
            <Button size='sm' variant='ghost' onClick={clear}>
              <Trash2 /> Clear
            </Button>
            {busy && <Spinner />}
          </>
        }
      >
        <Alert>{error}</Alert>
        <div className='flex min-h-0 flex-1 gap-2 max-lg:flex-col'>
          <Panel
            title={`${doc.name} · ${doc.count} ${doc.count === 1 ? 'page' : 'pages'}`}
            actions={<span className='px-1.5 text-xs text-muted-foreground'>{hint}</span>}
            className='flex-1'
          >
            <div className='flex flex-col items-center gap-3 bg-muted/30 p-3'>
              {Array.from({ length: doc.count }, (_, i) => (
                <PageView
                  key={i}
                  index={i}
                  count={doc.count}
                  page={pages[i]}
                  items={items.filter((it) => it.page === i)}
                  selected={selected}
                  mode={mode}
                  watermark={watermark}
                  numbers={numbers}
                  onSelect={setSelected}
                  onPlace={(x, y) => place(i, x, y)}
                  onChange={change}
                  onDelete={remove}
                />
              ))}
            </div>
          </Panel>
          <Panel title='Properties' className='shrink-0 lg:w-72'>
            <div className='flex flex-col gap-4 p-2.5 text-xs'>
              <section className='flex flex-col gap-2'>
                <h3 className='font-medium'>
                  {sel
                    ? `Selected ${sel.kind === 'whiteout' ? 'white-out' : sel.kind} · page ${sel.page + 1}`
                    : 'Nothing selected'}
                </h3>
                {sel?.kind === 'text' && (
                  <>
                    <Textarea
                      aria-label='Text'
                      rows={3}
                      className='font-sans text-[13px]'
                      value={sel.text}
                      onChange={(e) => change({ ...sel, text: e.target.value })}
                    />
                    <div className='flex flex-wrap items-center gap-1.5'>
                      <select
                        aria-label='Font'
                        className={selectClass}
                        value={sel.font}
                        onChange={(e) => change({ ...sel, font: e.target.value as FontKey })}
                      >
                        {Object.entries(FONTS).map(([k, f]) => (
                          <option key={k} value={k}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label='Font size'
                        type='number'
                        min={4}
                        max={200}
                        className={numberClass}
                        value={sel.size}
                        onChange={(e) => change({ ...sel, size: Math.max(1, Number(e.target.value) || 1) })}
                      />
                      <input
                        aria-label='Text color'
                        type='color'
                        className='h-7 w-8 cursor-pointer rounded-md border bg-background p-0.5'
                        value={sel.color}
                        onChange={(e) => change({ ...sel, color: e.target.value })}
                      />
                    </div>
                  </>
                )}
                {sel?.kind === 'whiteout' && (
                  <p className='text-muted-foreground'>
                    Covers what is under it. The text underneath is still in the file and can be copied out.
                  </p>
                )}
                {sel ? (
                  <Button size='sm' variant='outline' className='self-start' onClick={() => remove(sel.id)}>
                    <X /> Delete
                  </Button>
                ) : (
                  <p className='text-muted-foreground'>
                    Click an item to edit it. Drag to move, drag its corner to resize; arrow keys nudge, Delete removes.
                  </p>
                )}
              </section>

              <section className='flex flex-col gap-2'>
                <Checkbox
                  title='Watermark on every page'
                  checked={watermark.enabled}
                  onChange={(e) => setWatermark({ ...watermark, enabled: e.target.checked })}
                />
                {watermark.enabled && (
                  <>
                    <Input
                      aria-label='Watermark text'
                      className='h-7 text-xs'
                      value={watermark.text}
                      onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                    />
                    <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
                      <label className={row}>
                        Size
                        <Input
                          type='number'
                          min={6}
                          max={300}
                          className={numberClass}
                          value={watermark.size}
                          onChange={(e) =>
                            setWatermark({ ...watermark, size: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                      </label>
                      <label className={row}>
                        Angle
                        <Input
                          type='number'
                          min={-180}
                          max={180}
                          step={15}
                          className={numberClass}
                          value={watermark.rotation}
                          onChange={(e) => setWatermark({ ...watermark, rotation: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <input
                        aria-label='Watermark color'
                        type='color'
                        className='h-7 w-8 cursor-pointer rounded-md border bg-background p-0.5'
                        value={watermark.color}
                        onChange={(e) => setWatermark({ ...watermark, color: e.target.value })}
                      />
                    </div>
                    <label className={row}>
                      Opacity
                      <input
                        type='range'
                        min={0.05}
                        max={1}
                        step={0.05}
                        className='flex-1 accent-foreground'
                        value={watermark.opacity}
                        onChange={(e) => setWatermark({ ...watermark, opacity: Number(e.target.value) })}
                      />
                      <span className='w-8 text-right font-mono'>{Math.round(watermark.opacity * 100)}%</span>
                    </label>
                  </>
                )}
              </section>

              <section className='flex flex-col gap-2'>
                <Checkbox
                  title='Page numbers'
                  checked={numbers.enabled}
                  onChange={(e) => setNumbers({ ...numbers, enabled: e.target.checked })}
                />
                {numbers.enabled && (
                  <>
                    <Input
                      aria-label='Page number format'
                      title='{n} is the page number, {total} the last one'
                      className='h-7 text-xs'
                      value={numbers.format}
                      onChange={(e) => setNumbers({ ...numbers, format: e.target.value })}
                    />
                    <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
                      <select
                        aria-label='Page number position'
                        className={selectClass}
                        value={numbers.position}
                        onChange={(e) => setNumbers({ ...numbers, position: e.target.value as NumberPosition })}
                      >
                        {(['top', 'bottom'] as const).flatMap((v) =>
                          (['left', 'center', 'right'] as const).map((h) => (
                            <option key={`${v}-${h}`} value={`${v}-${h}`}>
                              {v === 'top' ? 'Top' : 'Bottom'} {h}
                            </option>
                          )),
                        )}
                      </select>
                      <label className={row}>
                        Start at
                        <Input
                          type='number'
                          className={numberClass}
                          value={numbers.start}
                          onChange={(e) => setNumbers({ ...numbers, start: Math.trunc(Number(e.target.value) || 0) })}
                        />
                      </label>
                      <label className={row}>
                        Size
                        <Input
                          type='number'
                          min={4}
                          max={72}
                          className={numberClass}
                          value={numbers.size}
                          onChange={(e) => setNumbers({ ...numbers, size: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </label>
                    </div>
                    <p className='text-muted-foreground'>
                      <code>{'{n}'}</code> is the page number, <code>{'{total}'}</code> the last one.
                    </p>
                  </>
                )}
              </section>
            </div>
          </Panel>
        </div>
      </Workspace>
    </DropTarget>
  )
}

export default EditPdf
