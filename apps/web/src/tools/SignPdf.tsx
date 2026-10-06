import { CalendarDays, Download, Eraser, Plus, Signature as SignatureIcon, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { mm, moveRect, openPdf, type Rect, renamePdf, resizeRect } from '@/lib/pdf'
import { renderPages } from '@/lib/pdf-render'
import { inkBounds, type PageBox, type Placement, signPdf, stripWhite, viewSize } from '@/lib/sign-pdf'
import { cn, downloadBlob } from '@/lib/utils'

interface Doc {
  name: string
  bytes: Uint8Array
  pages: PageBox[]
}

/** A trimmed PNG ready to place */
interface Stamp {
  src: string
  width: number
  height: number
}

/** Script-looking system fonts; nothing is downloaded. Each stack ends in the generic `cursive`. */
const FONTS = {
  script: ["'Brush Script MT', 'Brush Script Std', 'Snell Roundhand', 'URW Chancery L', 'Z003', cursive", 'Script'],
  chancery: ["'Apple Chancery', 'Lucida Handwriting', 'Segoe Script', 'URW Chancery L', cursive", 'Chancery'],
  hand: ["'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Comic Neue', cursive", 'Handwriting'],
  serif: ["italic Georgia, 'Times New Roman', serif", 'Italic serif'],
} as const
type Font = keyof typeof FONTS

/** Crops a canvas to its ink and encodes it as PNG; null when it is blank. */
function toStamp(canvas: HTMLCanvasElement): Stamp | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const box = inkBounds(ctx.getImageData(0, 0, canvas.width, canvas.height))
  if (!box) return null
  const out = Object.assign(document.createElement('canvas'), { width: box.width, height: box.height })
  out.getContext('2d')?.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height)
  return { src: out.toDataURL('image/png'), width: box.width, height: box.height }
}

/** One line of text in `font` (a CSS font shorthand without the size), as a stamp. */
function textStamp(text: string, font: string, ink: string): Stamp | null {
  if (!text.trim()) return null
  const size = 96
  // `italic Georgia` carries its own style; families alone get the size in front
  const spec = font.startsWith('italic ') ? `italic ${size}px ${font.slice(7)}` : `${size}px ${font}`
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.font = spec
  canvas.width = Math.ceil(ctx.measureText(text).width + size)
  canvas.height = size * 2
  ctx.font = spec // resizing resets the context
  ctx.fillStyle = ink
  ctx.textBaseline = 'middle'
  ctx.fillText(text, size / 2, size)
  return toStamp(canvas)
}

async function imageStamp(file: File, strip: boolean): Promise<Stamp | null> {
  const bitmap = await createImageBitmap(file)
  const s = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(bitmap.width * s),
    height: Math.round(bitmap.height * s),
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  if (strip) {
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height)
    stripWhite(px)
    ctx.putImageData(px, 0, 0)
  }
  return toStamp(canvas)
}

/** Pointer drawing pad; reports the trimmed drawing after each stroke. */
function DrawPad({ ink, onChange }: { ink: string; onChange: (s: Stamp | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)

  const point = (e: PointerEvent | React.PointerEvent) => {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }
  const ctx = () => {
    const c = ref.current?.getContext('2d')
    if (!c) return null
    Object.assign(c, { lineWidth: 5, lineCap: 'round', lineJoin: 'round', strokeStyle: ink, fillStyle: ink })
    return c
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <canvas
        ref={ref}
        width={900}
        height={300}
        role='img'
        aria-label='Signature drawing pad: draw with the mouse, a pen or a finger'
        className='w-full cursor-crosshair touch-none rounded-sm border bg-white'
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          const p = point(e)
          last.current = p
          const c = ctx()
          c?.beginPath()
          c?.arc(p.x, p.y, 2.5, 0, Math.PI * 2) // a dot for a plain click
          c?.fill()
        }}
        onPointerMove={(e) => {
          const c = ctx()
          if (!last.current || !c) return
          // Coalesced events (every sample since the last frame) keep fast strokes smooth
          c.beginPath()
          c.moveTo(last.current.x, last.current.y)
          const samples = e.nativeEvent.getCoalescedEvents?.() ?? []
          for (const ev of samples.length ? samples : [e.nativeEvent]) {
            last.current = point(ev)
            c.lineTo(last.current.x, last.current.y)
          }
          c.stroke()
        }}
        onPointerUp={() => {
          last.current = null
          if (ref.current) onChange(toStamp(ref.current))
        }}
      />
      <Button
        size='sm'
        variant='ghost'
        className='self-start'
        onClick={() => {
          const c = ref.current
          c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
          onChange(null)
        }}
      >
        <Eraser /> Clear pad
      </Button>
    </div>
  )
}

/** One page with its placed stamps; click to place, drag to move, drag the corner to resize. */
function SignPage({
  number,
  box,
  image,
  placements,
  onPlace,
  onMove,
  onRemove,
}: {
  number: number
  box: PageBox
  image?: string
  placements: Placement[]
  /** Centre of the new stamp, in points from the top-left */
  onPlace: (x: number, y: number) => void
  onMove: (id: string, rect: Rect) => void
  onRemove: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const view = viewSize(box)
  const ptPerPx = () => view.width / (ref.current?.getBoundingClientRect().width || 1)

  const drag = (e: React.PointerEvent<HTMLElement>, p: Placement, mode: 'move' | 'resize') => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const scale = ptPerPx()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - e.clientX) * scale
      const dy = (ev.clientY - e.clientY) * scale
      onMove(p.id, mode === 'move' ? moveRect(p.rect, dx, dy, view) : resizeRect(p.rect, dx, view))
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  const keys = (e: React.KeyboardEvent, p: Placement) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const step = mm(e.shiftKey ? 10 : 1)
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const m = moves[e.key]
    if (m) onMove(p.id, moveRect(p.rect, m[0], m[1], view))
    else if (e.key === '+' || e.key === '=' || e.key === '-')
      onMove(p.id, resizeRect(p.rect, e.key === '-' ? -step : step, view))
    else if (e.key === 'Delete' || e.key === 'Backspace') onRemove(p.id)
    else return
    e.preventDefault()
  }

  return (
    <div className='flex w-full max-w-3xl flex-col gap-1'>
      <div className='flex items-center justify-between text-xs text-muted-foreground'>
        <span className='font-mono'>Page {number}</span>
        <Button size='sm' variant='ghost' onClick={() => onPlace(view.width / 2, view.height * 0.8)}>
          <Plus /> Place here
        </Button>
      </div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: clicking the page is a shortcut; "Place here" is the button */}
      <div
        ref={ref}
        role='group'
        aria-label={`Page ${number}`}
        className='relative w-full cursor-copy touch-none border bg-white shadow-sm select-none'
        style={{ aspectRatio: `${view.width} / ${view.height}` }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onPlace((e.clientX - r.left) * ptPerPx(), (e.clientY - r.top) * ptPerPx())
        }}
      >
        {image ? (
          <img src={image} alt='' draggable={false} className='pointer-events-none size-full' />
        ) : (
          <div className='absolute inset-0 flex items-center justify-center'>
            <Spinner />
          </div>
        )}
        {placements.map((p) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: only stops the click reaching the page
          // biome-ignore lint/a11y/useKeyWithClickEvents: as above
          <div
            key={p.id}
            className='group absolute'
            style={{
              left: `${(p.rect.x / view.width) * 100}%`,
              top: `${((view.height - p.rect.y - p.rect.height) / view.height) * 100}%`,
              width: `${(p.rect.width / view.width) * 100}%`,
              height: `${(p.rect.height / view.height) * 100}%`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type='button'
              aria-label='Placed stamp: drag or use arrow keys to move (Shift for 10 mm), + and - to resize, Delete to remove'
              title='Drag to move, drag the corner to resize'
              className='size-full cursor-move outline-offset-1 hover:outline hover:outline-foreground/40 focus-visible:outline-2 focus-visible:outline-foreground'
              onPointerDown={(e) => drag(e, p, 'move')}
              onKeyDown={(e) => keys(e, p)}
            >
              <img src={p.src} alt='' draggable={false} className='size-full' />
              <span
                aria-hidden
                className='absolute -right-1 -bottom-1 hidden size-2.5 cursor-nwse-resize border border-white bg-foreground group-focus-within:block group-hover:block'
                onPointerDown={(e) => drag(e, p, 'resize')}
              />
            </button>
            <button
              type='button'
              aria-label='Remove'
              title='Remove'
              className='absolute -top-2.5 -right-2.5 hidden size-5 items-center justify-center rounded-full border bg-background text-foreground shadow-xs group-focus-within:flex group-hover:flex [&_svg]:size-3'
              onClick={() => onRemove(p.id)}
            >
              <X />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')

/** Bumped per open and clear, so a slower earlier open (or its page renders) stops writing state. */
let generation = 0

function SignPdf() {
  const [doc, setDoc] = useToolState<Doc | null>('sign-pdf:doc', null)
  const [images, setImages] = useToolState<string[]>('sign-pdf:images', [])
  const [placements, setPlacements] = useToolState<Placement[]>('sign-pdf:placements', [])
  // The signature is kept in memory for the session, so it can be reused on the next PDF
  const [signature, setSignature] = useToolState<Stamp | null>('sign-pdf:signature', null)
  const [source, setSource] = useToolState<'draw' | 'type' | 'upload'>('sign-pdf:source', 'draw')
  const [typed, setTyped] = useToolState('sign-pdf:typed', '')
  const [font, setFont] = useToolState<Font>('sign-pdf:font', 'script')
  const [ink, setInk] = useToolState('sign-pdf:ink', '#111111')
  const [upload, setUpload] = useToolState<File | null>('sign-pdf:upload', null)
  const [strip, setStrip] = useToolState('sign-pdf:strip', true)
  const [stamp, setStampKind] = useToolState<'signature' | 'date'>('sign-pdf:stamp', 'signature')
  const [dateText, setDateText] = useToolState('sign-pdf:date', () => new Date().toLocaleDateString())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Typed and uploaded signatures follow their inputs; a drawing reports itself after each stroke
  useEffect(() => {
    if (source === 'type') setSignature(textStamp(typed, FONTS[font][0], ink))
  }, [source, typed, font, ink, setSignature])
  useEffect(() => {
    if (source !== 'upload' || !upload) return
    let live = true
    imageStamp(upload, strip).then(
      (s) => live && setSignature(s),
      () => live && setError(`Could not read ${upload.name}. Use PNG, JPEG or WebP.`),
    )
    return () => {
      live = false
    }
  }, [source, upload, strip, setSignature])

  const open = async ([file]: File[]) => {
    if (!file) return
    const gen = ++generation
    setError('')
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const pdf = await openPdf(bytes)
      if (gen !== generation) return
      const pages = pdf.getPages().map((p) => ({ ...p.getCropBox(), rotation: p.getRotation().angle }))
      setDoc({ name: file.name, bytes, pages })
      setPlacements([])
      setImages([])
      setBusy(false)
      await renderPages(
        bytes,
        1400,
        (i, url) =>
          setImages((t) => {
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

  const place = (page: number, cx: number, cy: number) => {
    const s = stamp === 'date' ? textStamp(dateText, "'Helvetica Neue', Helvetica, Arial, sans-serif", ink) : signature
    if (!s || !doc) {
      setError(stamp === 'date' ? 'Enter the date text first' : 'Create a signature first: draw, type or upload one')
      return
    }
    setError('')
    const view = viewSize(doc.pages[page]!)
    const ratio = s.height / s.width
    // Signatures start about 50 mm wide, dates about 4 mm tall (10–11 pt text)
    const width = stamp === 'date' ? mm(4) / ratio : Math.min(mm(50), mm(18) / ratio)
    const height = width * ratio
    const rect = moveRect({ x: cx - width / 2, y: view.height - cy - height / 2, width, height }, 0, 0, view)
    setPlacements((ps) => [...ps, { id: crypto.randomUUID(), page, src: s.src, rect }])
  }

  const download = async () => {
    if (!doc) return
    setBusy(true)
    setError('')
    try {
      downloadBlob(
        await signPdf(await openPdf(doc.bytes), placements),
        renamePdf(doc.name, 'signed'),
        'application/pdf',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const clear = () => {
    generation++
    setDoc(null)
    setImages([])
    setPlacements([])
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
          hint='Then draw, type or upload a signature and click the page to place it. Nothing is uploaded.'
        >
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
            <Button size='sm' onClick={() => void download()} disabled={busy || !placements.length}>
              <Download /> Download signed PDF
            </Button>
            <Segmented
              label='Clicking a page places'
              value={stamp}
              onChange={setStampKind}
              options={[
                ['signature', 'Place signature'],
                ['date', 'Place date'],
              ]}
            />
            {stamp === 'date' && (
              <Input
                aria-label='Date text'
                className='h-7 w-32 text-xs'
                value={dateText}
                onChange={(e) => setDateText(e.target.value)}
              />
            )}
            <FileButton
              size='sm'
              variant='ghost'
              accept='application/pdf,.pdf'
              onFileSelected={(e) => void open(Array.from(e.target.files ?? []))}
            >
              Open another
            </FileButton>
            {placements.length > 0 && (
              <Button size='sm' variant='ghost' onClick={() => setPlacements([])}>
                <Eraser /> Remove all
              </Button>
            )}
            <Button size='sm' variant='ghost' onClick={clear}>
              <Trash2 /> Clear
            </Button>
            {busy && <Spinner />}
          </>
        }
      >
        <Alert>{error}</Alert>
        <div className='grid min-h-0 flex-1 gap-2 max-lg:grid-rows-[auto_1fr] lg:grid-cols-[22rem_1fr]'>
          <Panel title='Signature'>
            <div className='flex flex-col gap-2 p-2.5'>
              <div className='flex items-center justify-between gap-2'>
                <Segmented
                  label='Signature source'
                  value={source}
                  onChange={setSource}
                  options={[
                    ['draw', 'Draw'],
                    ['type', 'Type'],
                    ['upload', 'Upload'],
                  ]}
                />
                {source !== 'upload' && (
                  <label className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    Ink
                    <input
                      type='color'
                      aria-label='Ink colour'
                      className='h-7 w-8 cursor-pointer rounded-md border bg-transparent p-0.5'
                      value={ink}
                      onChange={(e) => setInk(e.target.value)}
                    />
                  </label>
                )}
              </div>
              {source === 'draw' && <DrawPad ink={ink} onChange={setSignature} />}
              {source === 'type' && (
                <>
                  <Input
                    aria-label='Your name'
                    placeholder='Type your name'
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                  />
                  <select
                    aria-label='Font'
                    className={selectClass}
                    value={font}
                    onChange={(e) => setFont(e.target.value as Font)}
                  >
                    {Object.entries(FONTS).map(([value, [, label]]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {source === 'upload' && (
                <>
                  <FileButton
                    size='sm'
                    className='self-start'
                    accept='image/*'
                    onFileSelected={(e) => setUpload(e.target.files?.[0] ?? null)}
                  >
                    <Upload /> {upload ? upload.name : 'Choose an image'}
                  </FileButton>
                  <Checkbox
                    title='Remove the white background'
                    checked={strip}
                    onChange={(e) => setStrip(e.target.checked)}
                  />
                </>
              )}
              <div className='flex flex-col gap-1'>
                <span className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
                  Ready to place
                </span>
                <div className='flex h-24 items-center justify-center rounded-sm border bg-white p-2'>
                  {signature ? (
                    <img src={signature.src} alt='Your signature' className='max-h-full max-w-full' />
                  ) : (
                    <span className='flex items-center gap-1.5 text-xs text-neutral-500'>
                      <SignatureIcon className='size-4' /> No signature yet
                    </span>
                  )}
                </div>
                <p className='text-xs text-muted-foreground'>
                  Click a page to place the {stamp === 'date' ? 'date' : 'signature'}, as often as you like. Drag to
                  move, drag the corner to resize.
                  {stamp === 'date' && (
                    <>
                      {' '}
                      <CalendarDays className='inline size-3.5' /> Uses the ink colour.
                    </>
                  )}
                </p>
              </div>
            </div>
          </Panel>
          <Panel
            title={`${doc.name} · ${doc.pages.length} ${doc.pages.length === 1 ? 'page' : 'pages'}`}
            actions={<span className='px-1.5 font-mono text-xs text-muted-foreground'>{placements.length} placed</span>}
          >
            <div className='flex flex-col items-center gap-3 bg-muted/30 p-3'>
              {doc.pages.map((box, i) => (
                <SignPage
                  key={i}
                  number={i + 1}
                  box={box}
                  image={images[i]}
                  placements={placements.filter((p) => p.page === i)}
                  onPlace={(x, y) => place(i, x, y)}
                  onMove={(id, rect) => setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, rect } : p)))}
                  onRemove={(id) => setPlacements((ps) => ps.filter((p) => p.id !== id))}
                />
              ))}
            </div>
          </Panel>
        </div>
      </Workspace>
    </DropTarget>
  )
}

export default SignPdf
