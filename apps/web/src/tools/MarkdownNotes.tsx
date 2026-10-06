import type { OnMount } from '@monaco-editor/react'
import { Download, FilePlus, FileText, FolderOpen, PanelLeft, TableOfContents, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CodeEditor } from '@/components/ui/code-editor'
import { FileButton } from '@/components/ui/file-button'
import { Segmented } from '@/components/ui/segmented'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { interpolate, renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { type Note, type NotesView, noteTitle, useNotesStatus, useNotesStore } from '@/stores/notes.store'
import { useIsDark } from '@/stores/theme.store'

type MonacoEditor = Parameters<OnMount>[0]

// Rendered diagrams keyed by theme + source, so re-rendering the preview on each keystroke doesn't flicker
const diagrams = new Map<string, string>()
let diagramSeq = 0

/** Renders the ```mermaid blocks under root into SVG; cached diagrams are applied synchronously. */
async function renderDiagrams(root: ParentNode, dark: boolean, cancelled = () => false) {
  const pending: [HTMLElement, string][] = []
  for (const el of root.querySelectorAll<HTMLElement>('pre.mermaid')) {
    const key = `${dark}:${el.textContent}`
    const svg = diagrams.get(key)
    if (svg) el.innerHTML = svg
    else pending.push([el, key])
  }
  if (!pending.length) return
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'neutral' })
  for (const [el, key] of pending) {
    try {
      const { svg } = await mermaid.render(`mermaid-${++diagramSeq}`, key.slice(key.indexOf(':') + 1))
      diagrams.set(key, svg)
      if (!cancelled()) el.innerHTML = svg
    } catch (e) {
      if (!cancelled()) el.dataset.error = e instanceof Error ? e.message : String(e)
    }
  }
}

function useMermaid(container: React.RefObject<HTMLElement | null>, html: string, dark: boolean) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scan the DOM whenever the preview html changes
  useLayoutEffect(() => {
    if (!container.current) return
    let cancelled = false
    void renderDiagrams(container.current, dark, () => cancelled)
    return () => {
      cancelled = true
    }
  }, [container, html, dark])
}

/** Opens the print dialog for a note, rendered as an always-light document ("Save as PDF" in the dialog). */
async function exportPdf(note: Note) {
  const page = document.createElement('div')
  page.innerHTML = renderMarkdown(note.body).html
  await renderDiagrams(page, false)
  const { printDocument } = await import('@/lib/print-document')
  await printDocument(noteTitle(note), page.innerHTML)
}

/** Keeps the preview scrolled to the part of the note the editor shows, and the other way round. */
function useScrollSync(editor: MonacoEditor | null, preview: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const scroller = preview.current?.parentElement
    if (!enabled || !editor || !scroller) return
    // Ignore the scroll events our own programmatic scrolling causes on the other pane
    let lock = { side: '', until: 0 }
    const locked = (side: string) => lock.side === side && performance.now() < lock.until
    const scrolling = (side: string) => {
      lock = { side, until: performance.now() + 100 }
    }
    // [source line, preview offset] for every top-level block, plus both ends
    const anchors = (): [number, number][] => [
      [1, 0],
      ...[...(preview.current?.querySelectorAll<HTMLElement>('[data-line]') ?? [])].map((el): [number, number] => [
        Number(el.dataset.line),
        el.offsetTop,
      ]),
      [(editor.getModel()?.getLineCount() ?? 1) + 1, scroller.scrollHeight],
    ]
    const atBottom = (top: number, height: number, view: number) => top > 0 && top >= height - view - 1

    const fromEditor = editor.onDidScrollChange(() => {
      if (locked('editor')) return
      scrolling('preview')
      const top = editor.getScrollTop()
      if (atBottom(top, editor.getScrollHeight(), editor.getLayoutInfo().height)) {
        scroller.scrollTop = scroller.scrollHeight
        return
      }
      const line = editor.getVisibleRanges()[0]?.startLineNumber ?? 1
      const lineTop = editor.getTopForLineNumber(line)
      const lineHeight = editor.getTopForLineNumber(line + 1) - lineTop
      scroller.scrollTop = interpolate(anchors(), line + (lineHeight > 0 ? (top - lineTop) / lineHeight : 0))
    })
    const fromPreview = () => {
      if (locked('preview')) return
      scrolling('editor')
      if (atBottom(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight)) {
        editor.setScrollTop(editor.getScrollHeight())
        return
      }
      const x = interpolate(
        anchors().map(([line, top]) => [top, line]),
        scroller.scrollTop,
      )
      const line = Math.floor(x)
      const lineTop = editor.getTopForLineNumber(line)
      editor.setScrollTop(lineTop + (x - line) * (editor.getTopForLineNumber(line + 1) - lineTop))
    }
    scroller.addEventListener('scroll', fromPreview, { passive: true })
    return () => {
      fromEditor.dispose()
      scroller.removeEventListener('scroll', fromPreview)
    }
  }, [editor, preview, enabled])
}

function download(name: string, body: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/markdown' }))
  a.download = `${name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'note'}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

function Notes() {
  const dark = useIsDark()
  const {
    notes,
    activeId,
    view,
    syncScroll,
    showNotes,
    showToc,
    create,
    update,
    remove,
    select,
    setView,
    setSyncScroll,
    toggleNotes,
    toggleToc,
  } = useNotesStore()
  const error = useNotesStatus((s) => s.error)
  const active = notes.find((n) => n.id === activeId) ?? (notes[0] as Note)
  const body = useDeferredValue(active.body)
  const { html, toc } = useMemo(() => renderMarkdown(body), [body])
  const preview = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<MonacoEditor | null>(null)
  useMermaid(preview, html, dark)
  useScrollSync(editor, preview, view === 'split' && syncScroll)

  const sorted = useMemo(() => [...notes].sort((a, b) => b.updated - a.updated), [notes])

  const jump = (id: string, line?: number) => {
    preview.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' })
    if (line && view !== 'preview' && editor) {
      editor.revealLineNearTop(line)
      editor.setPosition({ lineNumber: line, column: 1 })
    }
  }

  return (
    <Workspace
      toolbar={
        <>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-pressed={showNotes}
            title={showNotes ? 'Hide notes list' : 'Show notes list'}
            aria-label='Notes list'
            onClick={toggleNotes}
            className={cn(showNotes && 'bg-accent')}
          >
            <PanelLeft />
          </Button>
          <Button size='sm' variant='ghost' onClick={() => create()}>
            <FilePlus /> New
          </Button>
          <FileButton
            size='sm'
            variant='ghost'
            accept='.md,.markdown,.txt,text/markdown,text/plain'
            onFileSelected={async (e) => {
              const file = e.target.files?.[0]
              if (file) create(await file.text())
            }}
          >
            <FolderOpen /> Open
          </FileButton>
          <Button size='sm' variant='ghost' onClick={() => download(noteTitle(active), active.body)}>
            <Download /> Download .md
          </Button>
          <Button size='sm' variant='ghost' title='Print or save as PDF' onClick={() => void exportPdf(active)}>
            <FileText /> Export PDF
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => confirm(`Delete "${noteTitle(active)}"? This cannot be undone.`) && remove(active.id)}
          >
            <Trash2 /> Delete
          </Button>
          <div className='ml-auto flex items-center gap-3'>
            {view !== 'code' && (
              <Button
                size='icon-sm'
                variant='ghost'
                aria-pressed={showToc}
                title={showToc ? 'Hide contents' : 'Show contents'}
                aria-label='Contents'
                onClick={toggleToc}
                className={cn(showToc && 'bg-accent')}
              >
                <TableOfContents />
              </Button>
            )}
            {view === 'split' && (
              <Checkbox title='Sync scroll' checked={syncScroll} onChange={(e) => setSyncScroll(e.target.checked)} />
            )}
            <Segmented<NotesView>
              label='View'
              value={view}
              onChange={setView}
              options={[
                ['code', 'Code'],
                ['split', 'Split'],
                ['preview', 'Preview'],
              ]}
            />
          </div>
        </>
      }
    >
      <Alert>{error}</Alert>
      <div className='flex min-h-0 flex-1 gap-2 max-lg:flex-col'>
        {showNotes && (
          <Panel title={`Notes (${notes.length})`} className='shrink-0 max-lg:max-h-32 lg:w-52'>
            <ul aria-label='Notes'>
              {sorted.map((n) => (
                <li key={n.id}>
                  <button
                    type='button'
                    aria-current={n.id === active.id}
                    onClick={() => select(n.id)}
                    className={cn(
                      'block w-full truncate px-2.5 py-1 text-left hover:bg-accent',
                      n.id === active.id ? 'bg-accent font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {noteTitle(n)}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {view !== 'preview' && (
          <Panel title='Markdown' className='min-w-0 flex-1'>
            <CodeEditor
              path={active.id}
              defaultLanguage='markdown'
              value={active.body}
              onMount={(e) => {
                setEditor(e)
                e.onDidDispose(() => setEditor(null))
              }}
              onChange={(v) => update(v ?? '')}
              options={{
                ariaLabel: 'Markdown source',
                wordWrap: 'on',
                lineNumbers: 'off',
                folding: false,
              }}
            />
          </Panel>
        )}
        {view !== 'code' && (
          <Panel title='Preview' className='min-w-0 flex-1'>
            <div
              key={String(dark)}
              ref={preview}
              data-testid='preview'
              className={cn('md-preview relative p-4', view === 'preview' && 'mx-auto max-w-3xl')}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify in renderMarkdown
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Panel>
        )}
        {view !== 'code' && showToc && toc.length > 0 && (
          <Panel title='Contents' className='shrink-0 max-xl:hidden xl:w-52'>
            <nav aria-label='Table of contents' className='py-1'>
              {toc.map((h) => (
                <button
                  key={h.id}
                  type='button'
                  onClick={() => jump(h.id, h.line)}
                  style={{ paddingLeft: `${(h.depth - 1) * 0.75 + 0.625}rem` }}
                  className='block w-full truncate py-0.5 pr-2.5 text-left text-muted-foreground hover:text-foreground'
                >
                  {h.text}
                </button>
              ))}
            </nav>
          </Panel>
        )}
      </div>
    </Workspace>
  )
}

export default function MarkdownNotes() {
  // Editing before the saved notebook loads would overwrite it
  return useNotesStatus((s) => s.loaded) ? <Notes /> : null
}
