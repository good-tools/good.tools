import Editor, { type OnMount } from '@monaco-editor/react'
import { Download, FilePlus, FolderOpen, Trash2 } from 'lucide-react'
import { useDeferredValue, useLayoutEffect, useMemo, useRef } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileButton } from '@/components/ui/file-button'
import { Segmented } from '@/components/ui/segmented'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { type Note, type NotesView, noteTitle, useNotesSaveError, useNotesStore } from '@/stores/notes.store'
import { useIsDark } from '@/stores/theme.store'

type MonacoEditor = Parameters<OnMount>[0]

// Rendered diagrams keyed by theme + source, so re-rendering the preview on each keystroke doesn't flicker
const diagrams = new Map<string, string>()
let diagramSeq = 0

function useMermaid(container: React.RefObject<HTMLElement | null>, html: string, dark: boolean) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scan the DOM whenever the preview html changes
  useLayoutEffect(() => {
    const pending: [HTMLElement, string][] = []
    for (const el of container.current?.querySelectorAll<HTMLElement>('pre.mermaid') ?? []) {
      const key = `${dark}:${el.textContent}`
      const svg = diagrams.get(key)
      if (svg) el.innerHTML = svg
      else pending.push([el, key])
    }
    if (!pending.length) return
    let cancelled = false
    void import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'neutral' })
      for (const [el, key] of pending) {
        try {
          const { svg } = await mermaid.render(`mermaid-${++diagramSeq}`, key.slice(key.indexOf(':') + 1))
          diagrams.set(key, svg)
          if (!cancelled) el.innerHTML = svg
        } catch (e) {
          if (!cancelled) el.dataset.error = e instanceof Error ? e.message : String(e)
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [container, html, dark])
}

function download(name: string, body: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/markdown' }))
  a.download = `${name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'note'}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function MarkdownNotes() {
  const dark = useIsDark()
  const { notes, activeId, view, create, update, remove, select, setView } = useNotesStore()
  const saveError = useNotesSaveError((s) => s.error)
  const active = notes.find((n) => n.id === activeId) ?? (notes[0] as Note)
  const body = useDeferredValue(active.body)
  const { html, toc } = useMemo(() => renderMarkdown(body), [body])
  const preview = useRef<HTMLDivElement>(null)
  const editor = useRef<MonacoEditor>(null)
  useMermaid(preview, html, dark)

  const sorted = useMemo(() => [...notes].sort((a, b) => b.updated - a.updated), [notes])

  const jump = (id: string, line?: number) => {
    preview.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' })
    if (line && view !== 'preview' && editor.current) {
      editor.current.revealLineNearTop(line)
      editor.current.setPosition({ lineNumber: line, column: 1 })
    }
  }

  return (
    <Workspace
      toolbar={
        <>
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
          <Button
            size='sm'
            variant='ghost'
            onClick={() => confirm(`Delete "${noteTitle(active)}"? This cannot be undone.`) && remove(active.id)}
          >
            <Trash2 /> Delete
          </Button>
          <div className='ml-auto'>
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
      <Alert>{saveError && `Could not save to browser storage: ${saveError}. Download your note to keep it.`}</Alert>
      <div className='flex min-h-0 flex-1 gap-2 max-lg:flex-col'>
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
        {view !== 'preview' && (
          <Panel title='Markdown' className='min-w-0 flex-1'>
            <Editor
              height='100%'
              path={active.id}
              defaultLanguage='markdown'
              value={active.body}
              theme={dark ? 'vs-dark' : 'light'}
              onMount={(e) => {
                editor.current = e
              }}
              onChange={(v) => update(v ?? '')}
              options={{
                ariaLabel: 'Markdown source',
                minimap: { enabled: false },
                wordWrap: 'on',
                lineNumbers: 'off',
                folding: false,
                scrollBeyondLastLine: false,
                fontSize: 13,
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
              className={cn('md-preview p-4', view === 'preview' && 'mx-auto max-w-3xl')}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify in renderMarkdown
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Panel>
        )}
        {view !== 'code' && toc.length > 0 && (
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
