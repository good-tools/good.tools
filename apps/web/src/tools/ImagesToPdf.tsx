import { Download, Plus, RotateCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { SortableList } from '@/components/ui/sortable-list'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { imagesToPdf, type LayoutOptions, layoutPages, mm, type PageSize, type PdfImage } from '@/lib/pdf'
import { cn, downloadBlob } from '@/lib/utils'

interface Item extends PdfImage {
  id: string
  name: string
  file: File
  /** Clockwise degrees */
  rotation: number
  url: string
}

/**
 * Decodes and re-encodes through a canvas so the PDF gets what the user sees: EXIF orientation applied
 * (phone photos), plus the user's rotation. PNG stays lossless; everything else becomes JPEG.
 */
async function prepare(file: File, rotation: number, id: string = crypto.randomUUID()): Promise<Item> {
  const bitmap = await createImageBitmap(file)
  const turned = rotation % 180 !== 0
  const canvas = Object.assign(document.createElement('canvas'), {
    width: turned ? bitmap.height : bitmap.width,
    height: turned ? bitmap.width : bitmap.height,
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const format = file.type === 'image/png' ? 'png' : 'jpeg'
  if (format === 'jpeg') {
    ctx.fillStyle = '#fff' // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), `image/${format}`, 0.92),
  )
  return {
    id,
    name: file.name,
    file,
    rotation,
    format,
    width: canvas.width,
    height: canvas.height,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    url: URL.createObjectURL(blob),
  }
}

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')
const inlineLabel = 'flex items-center gap-1.5 text-xs text-muted-foreground'

function ImagesToPdf() {
  const [images, setImages] = useToolState<Item[]>('images-pdf:images', [])
  const [pageSize, setPageSize] = useToolState<PageSize>('images-pdf:pageSize', 'a4')
  const [landscape, setLandscape] = useToolState('images-pdf:landscape', false)
  const [perPage, setPerPage] = useToolState('images-pdf:perPage', 1)
  const [size, setSize] = useToolState<LayoutOptions['size']>('images-pdf:size', 'fit')
  const [marginMm, setMarginMm] = useToolState('images-pdf:margin', 10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const options: LayoutOptions = { pageSize, landscape, perPage, size, margin: mm(marginMm) }
  const pages = layoutPages(images, options)

  /** Replaces the list, freeing preview URLs of images that are gone. */
  const update = (next: Item[]) => {
    for (const i of images) if (!next.some((n) => n.url === i.url)) URL.revokeObjectURL(i.url)
    setImages(next)
  }

  const add = async (files: File[]) => {
    setError('')
    setBusy(true)
    const results = await Promise.allSettled(files.map((f) => prepare(f, 0)))
    const added = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failed = files.filter((_, i) => results[i]?.status === 'rejected').map((f) => f.name)
    if (failed.length) setError(`Could not read ${failed.join(', ')}. Use JPEG, PNG, WebP or GIF.`)
    setImages((prev) => [...prev, ...added])
    setBusy(false)
  }

  const rotate = async (item: Item) => {
    const turned = await prepare(item.file, (item.rotation + 90) % 360, item.id)
    update(images.map((i) => (i.id === item.id ? turned : i)))
  }

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      downloadBlob(await imagesToPdf(images, options), 'images.pdf', 'application/pdf')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  if (!images.length)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          multiple
          accept='image/*'
          onFiles={(f) => void add(f)}
          hint='e.g. the front and back of an ID card, on one page. Nothing is uploaded.'
        >
          Drop images here or click to browse
        </DropZone>
        {busy && <Spinner />}
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={() => void download()} disabled={busy}>
            <Download /> Download PDF
          </Button>
          <FileButton
            size='sm'
            accept='image/*'
            multiple
            onFileSelected={(e) => void add(Array.from(e.target.files ?? []))}
          >
            <Plus /> Add images
          </FileButton>
          <select
            aria-label='Page size'
            className={selectClass}
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as PageSize)}
          >
            <option value='a4'>A4</option>
            <option value='letter'>Letter</option>
            <option value='legal'>Legal</option>
            <option value='a5'>A5</option>
            <option value='fit'>Page = image size</option>
          </select>
          {pageSize !== 'fit' && (
            <>
              <Segmented
                label='Orientation'
                value={landscape ? 'landscape' : 'portrait'}
                onChange={(v) => setLandscape(v === 'landscape')}
                options={[
                  ['portrait', 'Portrait'],
                  ['landscape', 'Landscape'],
                ]}
              />
              <select
                aria-label='Images per page'
                className={selectClass}
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
              >
                {[1, 2, 4, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
            </>
          )}
          <select
            aria-label='Image size'
            className={selectClass}
            value={size}
            onChange={(e) => setSize(e.target.value as LayoutOptions['size'])}
          >
            <option value='fit'>Fit to space</option>
            <option value='card'>ID card size (85.6×54 mm)</option>
          </select>
          <label className={inlineLabel}>
            Margin
            <Input
              type='number'
              min={0}
              max={50}
              className='h-7 w-14 text-xs'
              value={marginMm}
              onChange={(e) => setMarginMm(Math.max(0, Number(e.target.value)))}
            />
            mm
          </label>
          <Button size='sm' variant='ghost' onClick={() => update([])}>
            <Trash2 /> Clear
          </Button>
          {busy && <Spinner />}
        </>
      }
    >
      <Alert>{error}</Alert>
      <Split>
        <Panel title={`${images.length} images`}>
          <SortableList
            items={images}
            onChange={update}
            actions={(item) => (
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label={`Rotate ${item.name}`}
                onClick={() => void rotate(item)}
              >
                <RotateCw />
              </Button>
            )}
          >
            {(item) => (
              <>
                <img src={item.url} alt='' className='size-9 shrink-0 rounded-sm border object-contain' />
                <span className='min-w-0 truncate' title={item.name}>
                  {item.name}
                </span>
                <span className='shrink-0 font-mono text-xs text-muted-foreground'>
                  {item.width}×{item.height}
                </span>
              </>
            )}
          </SortableList>
        </Panel>
        <Panel title={`Preview · ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`}>
          <div className='flex flex-col items-center gap-3 bg-muted/30 p-3'>
            {pages.map((page, n) => (
              <div
                key={n}
                role='img'
                aria-label={`Page ${n + 1}`}
                className='relative w-full max-w-md border bg-white shadow-sm'
                style={{ aspectRatio: `${page.width} / ${page.height}` }}
              >
                {page.items.map((it) => (
                  <img
                    key={it.index}
                    src={images[it.index]?.url}
                    alt={images[it.index]?.name}
                    className='absolute'
                    style={{
                      left: `${(it.x / page.width) * 100}%`,
                      top: `${((page.height - it.y - it.height) / page.height) * 100}%`,
                      width: `${(it.width / page.width) * 100}%`,
                      height: `${(it.height / page.height) * 100}%`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </Panel>
      </Split>
    </Workspace>
  )
}

export default ImagesToPdf
