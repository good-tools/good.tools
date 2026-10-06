import { filesize } from 'filesize'
import { FileText, Printer, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { printCss, rejectReason } from '@/lib/word-to-pdf'

interface Source {
  name: string
  bytes: Uint8Array
}

const ACCEPT = '.docx,.docm,.dotx,.dotm,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Renders the document into the (isolated) iframe and wires up print CSS. Returns the page count. */
async function render(frame: HTMLIFrameElement, source: Source): Promise<number> {
  const doc = frame.contentDocument
  if (!doc) throw new Error('Preview is not available')
  // Standards mode (a bare about:blank is quirks mode), and links open outside the preview
  doc.open()
  doc.write('<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body></body></html>')
  doc.close()
  const { renderAsync } = await import('docx-preview')
  await renderAsync(source.bytes, doc.body, doc.head, {
    inWrapper: true,
    renderChanges: false,
    renderComments: false,
  })
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('.docx-wrapper > section.docx'))
  const { css, names } = printCss(pages.map((p) => ({ width: p.style.width, height: p.style.minHeight })))
  pages.forEach((p, i) => {
    if (names[i]) p.style.setProperty('page', names[i])
    p.style.setProperty('--page-h', p.style.minHeight || '0px')
    // docx-preview pulls the footer into the bottom margin with a negative margin, which spills a blank sheet
    // when printing. Pin it at its footer distance from the page bottom instead.
    const footer = p.querySelector<HTMLElement>(':scope > footer')
    if (!footer) return
    const page = getComputedStyle(p)
    const bottom = Number.parseFloat(page.paddingBottom) + Number.parseFloat(getComputedStyle(footer).marginBottom)
    Object.assign(footer.style, {
      position: 'absolute',
      left: page.paddingLeft,
      right: page.paddingRight,
      bottom: `${bottom}px`,
      marginBottom: '0',
    })
  })
  doc.title = source.name.replace(/\.[^.]+$/, '') // the default "Save as PDF" file name
  const style = doc.createElement('style')
  style.textContent = `html, body { margin: 0; background: transparent; color-scheme: light }
@media screen { .docx-wrapper { background: transparent; padding: 16px 16px 0 } }
${css}`
  doc.head.append(style)
  return pages.length
}

/** Scales the pages down to the preview's width (screen only; printing is always 100%). */
function fitWidth(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument
  const wrapper = doc?.querySelector<HTMLElement>('.docx-wrapper')
  if (!doc || !wrapper) return
  const widest = Math.max(...Array.from(doc.querySelectorAll<HTMLElement>('section.docx'), (p) => p.offsetWidth))
  wrapper.style.zoom = String(Math.min(1, (frame.clientWidth - 32) / widest))
}

function WordToPdf() {
  const [source, setSource] = useToolState<Source | null>('word-to-pdf:source', null)
  const [pages, setPages] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)

  const load = async ([file]: File[]) => {
    if (!file) return
    setError('')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const reason = rejectReason(file.name, bytes)
    if (reason) return setError(reason)
    setSource({ name: file.name, bytes })
  }

  useEffect(() => {
    const el = frame.current
    if (!source || !el) return
    let live = true
    setBusy(true)
    setPages(0)
    render(el, source)
      .then(
        (n) => {
          if (!live) return
          setPages(n)
          fitWidth(el)
        },
        (e: unknown) =>
          live && setError(`Could not read ${source.name}: ${e instanceof Error ? e.message : String(e)}`),
      )
      .finally(() => live && setBusy(false))
    const observer = new ResizeObserver(() => fitWidth(el))
    observer.observe(el)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [source])

  if (!source)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          accept={ACCEPT}
          onFiles={(f) => void load(f)}
          hint='Word .docx files. Nothing is uploaded: the document is rendered in your browser.'
        >
          Drop a Word document here or click to browse
        </DropZone>
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <DropTarget onFiles={(f) => void load(f)} label='Drop to replace the document'>
      <Workspace
        toolbar={
          <>
            <Button size='sm' disabled={busy || !pages} onClick={() => frame.current?.contentWindow?.print()}>
              <Printer /> Save as PDF…
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => {
                setSource(null)
                setError('')
              }}
            >
              <Trash2 /> Clear
            </Button>
            <span className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
              <FileText className='size-3.5 shrink-0' />
              <span className='truncate'>{source.name}</span>
              <span>{filesize(source.bytes.byteLength, { base: 2 })}</span>
            </span>
            {busy && <Spinner />}
          </>
        }
      >
        <Alert>{error}</Alert>
        <Alert variant='info'>
          In the print dialog, choose <b>Save as PDF</b> as the destination and keep <b>Margins: Default</b> and{' '}
          <b>Scale: 100</b>. The text stays selectable. Layout is approximate for complex documents (text boxes, shapes,
          fields, some fonts).
        </Alert>
        <Panel title={pages ? `Preview · ${pages} ${pages === 1 ? 'page' : 'pages'}` : 'Preview'} className='flex-1'>
          <iframe
            ref={frame}
            title='Document preview'
            // Same origin so we can render into it and print it; no scripts, so the document can't run any
            sandbox='allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox'
            className='block size-full bg-muted/30 [color-scheme:light]'
          />
        </Panel>
      </Workspace>
    </DropTarget>
  )
}

export default WordToPdf
