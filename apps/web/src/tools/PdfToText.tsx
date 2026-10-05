import { Download, ScanText, Trash2 } from 'lucide-react'
import { GlobalWorkerOptions, getDocument, PasswordResponses } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { Input, Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, paneField, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { downloadBlob } from '@/lib/utils'

GlobalWorkerOptions.workerSrc = workerUrl

interface Result {
  name: string
  bytes: Uint8Array
  password: string
  pages: string[]
}

/** Text of every page; text items marked end-of-line become newlines. */
async function extractText(bytes: Uint8Array, password: string): Promise<string[]> {
  // pdf.js transfers the buffer to its worker; keep ours for a retry with another password
  const task = getDocument({ data: bytes.slice(), password })
  const doc = await task.promise
  try {
    const pages: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const { items } = await (await doc.getPage(n)).getTextContent()
      pages.push(items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : '') : '')).join(''))
    }
    return pages
  } finally {
    void task.destroy()
  }
}

/** Renders the given pages (0-based) at ~300 dpi and reads them with Tesseract, one at a time. */
async function ocrPages(
  r: Result,
  which: number[],
  onPage: (n: number, text: string) => void,
  onStatus: (status: string) => void,
) {
  onStatus('Loading OCR engine…')
  const { createOcrWorker } = await import('@/lib/ocr') // ~7 MB; only fetched for scans
  let k = 0
  const worker = await createOcrWorker((p) =>
    onStatus(`OCR page ${k + 1} of ${which.length} · ${Math.round(p * 100)}%`),
  )
  const task = getDocument({ data: r.bytes.slice(), password: r.password })
  try {
    const doc = await task.promise
    for (; k < which.length; k++) {
      const n = which[k]!
      const page = await doc.getPage(n + 1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(300 / 72, 4000 / Math.max(base.width, base.height)) })
      const canvas = Object.assign(document.createElement('canvas'), { width: viewport.width, height: viewport.height })
      await page.render({ canvas, viewport }).promise
      onPage(n, (await worker.recognize(canvas)).data.text)
    }
  } finally {
    void worker.terminate()
    void task.destroy()
  }
}

function PdfToText() {
  const [result, setResult] = useToolState<Result | null>('pdf-text:result', null)
  const [separators, setSeparators] = useToolState('pdf-text:separators', true)
  const [pending, setPending] = useState<{ name: string; bytes: Uint8Array } | null>(null)
  const [password, setPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ocrStatus, setOcrStatus] = useState('')

  const extract = async (name: string, bytes: Uint8Array, pw = '') => {
    setBusy(true)
    setError('')
    try {
      setResult({ name, bytes, password: pw, pages: await extractText(bytes, pw) })
      setPending(null)
      setNeedsPassword(false)
      setPassword('')
    } catch (e) {
      if (e instanceof Error && e.name === 'PasswordException') {
        setPending({ name, bytes })
        setNeedsPassword(true)
        if ((e as Error & { code: number }).code === PasswordResponses.INCORRECT_PASSWORD) setError('Wrong password')
      } else setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const openFile = ([f]: File[]) => {
    if (f) void f.arrayBuffer().then((b) => extract(f.name, new Uint8Array(b)))
  }

  const clear = () => {
    setResult(null)
    setPending(null)
    setNeedsPassword(false)
    setError('')
  }

  const text = result
    ? separators
      ? result.pages.map((p, i) => `--- Page ${i + 1} ---\n${p.trim()}`).join('\n\n')
      : result.pages.join('\n\n')
    : ''
  const scanned = result ? result.pages.flatMap((p, n) => (p.trim() ? [] : [n])) : []

  const ocr = async () => {
    if (!result) return
    setError('')
    try {
      await ocrPages(
        result,
        scanned,
        (n, pageText) => setResult((r) => r && { ...r, pages: r.pages.map((p, i) => (i === n ? pageText : p)) }),
        setOcrStatus,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setOcrStatus('')
  }

  if (!result)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          accept='application/pdf,.pdf'
          onFiles={openFile}
          hint='Extracted locally with pdf.js'
        >
          Drop a PDF here or click to browse
        </DropZone>
        {needsPassword && pending && (
          <form
            className='flex max-w-sm items-center gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              void extract(pending.name, pending.bytes, password)
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
            <Button type='submit' size='sm' disabled={busy}>
              Open
            </Button>
          </form>
        )}
        {busy && <Spinner label='Extracting…' />}
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <DropTarget onFiles={openFile} label='Drop to open another PDF'>
      <Workspace
        toolbar={
          <>
            <CopyButton variant='outline' value={text} />
            <Button
              size='sm'
              variant='outline'
              onClick={() => downloadBlob(text, `${result.name.replace(/\.pdf$/i, '')}.txt`, 'text/plain')}
            >
              <Download /> Download .txt
            </Button>
            <Checkbox title='Page separators' checked={separators} onChange={(e) => setSeparators(e.target.checked)} />
            <Button size='sm' variant='ghost' onClick={clear} disabled={!!ocrStatus}>
              <Trash2 /> Clear
            </Button>
            {ocrStatus && <Spinner label={ocrStatus} />}
          </>
        }
      >
        <Alert>{error}</Alert>
        {scanned.length > 0 && !ocrStatus && (
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
          actions={<span className='px-1.5 text-xs text-muted-foreground'>{text.length.toLocaleString()} chars</span>}
          className='flex-1'
        >
          <Textarea aria-label='Extracted text' readOnly value={text} className={paneField} />
        </Panel>
      </Workspace>
    </DropTarget>
  )
}

export default PdfToText
