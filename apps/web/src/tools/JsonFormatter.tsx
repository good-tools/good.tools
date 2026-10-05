import type { OnMount } from '@monaco-editor/react'
import { Allotment } from 'allotment'
import { useMemo, useState } from 'react'
import 'allotment/dist/style.css'
import { filesize } from 'filesize'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  CircleCheck,
  CircleX,
  Eraser,
  Filter,
  Minimize2,
  WandSparkles,
} from 'lucide-react'
import { JsonTree, useJsonTree } from '@/components/JsonTree'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CodeEditor } from '@/components/ui/code-editor'
import { CopyButton } from '@/components/ui/copy-button'
import { Segmented } from '@/components/ui/segmented'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { cn } from '@/lib/utils'
import { applyJsonPath, type Indent, stringify, useJSONFormatterStore } from '@/stores/json-formatter.store'

type MonacoEditor = Parameters<OnMount>[0]
type Marker = { line: number; column: number }

function JsonFormatter() {
  const { value, setValue, parsed, error, query, setQuery, tree, setTree, indent, setIndent, sort, setSort } =
    useJSONFormatterStore()
  const [editor, setEditor] = useState<MonacoEditor | null>(null)
  // Monaco's JSON validator gives a line/column even when JSON.parse's message doesn't
  const [marker, setMarker] = useState<Marker | null>(null)
  const [selected, setSelected] = useState<string>()
  const { result, error: queryError } = useMemo(() => applyJsonPath(parsed, query), [parsed, query])
  const output = useMemo(() => (result === undefined ? '' : stringify(result, indent, sort)), [result, indent, sort])
  const treeState = useJsonTree(result)

  const format = () => {
    if (parsed !== undefined) setValue(stringify(parsed, indent, sort))
  }
  const minify = () => {
    if (parsed !== undefined) setValue(stringify(parsed, 'none', sort))
  }
  const goToError = () => {
    if (!editor || !marker) return
    editor.revealPositionInCenter({ lineNumber: marker.line, column: marker.column })
    editor.setPosition({ lineNumber: marker.line, column: marker.column })
    editor.focus()
  }

  // Capture phase so Monaco doesn't also handle Ctrl+Enter (insert line)
  const ctrlEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.stopPropagation()
      format()
    }
  }

  const showPath = tree && !!selected && result !== undefined
  const lines = value ? value.split('\n').length : 0
  const bytes = useMemo(() => new TextEncoder().encode(value).length, [value])

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={format} disabled={parsed === undefined} title='Format (Ctrl+Enter)'>
            <WandSparkles /> Format
          </Button>
          <Button size='sm' variant='outline' onClick={minify} disabled={parsed === undefined}>
            <Minimize2 /> Minify
          </Button>
          <Segmented<Indent>
            label='Indent'
            value={indent}
            onChange={setIndent}
            options={[
              ['2', '2 spaces'],
              ['4', '4 spaces'],
              ['tab', 'Tab'],
            ]}
          />
          <Checkbox title='Sort keys' checked={sort} onChange={(e) => setSort(e.target.checked)} />
          <Button size='sm' variant='ghost' className='ml-auto' onClick={() => setValue('')} disabled={!value}>
            <Eraser /> Clear
          </Button>
        </>
      }
    >
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card'>
        <div className='min-h-0 flex-1'>
          <Allotment>
            <Allotment.Pane minSize={260}>
              <Panel title='Input' className='h-full rounded-none border-0'>
                <div className='h-full' onKeyDownCapture={ctrlEnter}>
                  <CodeEditor
                    value={value}
                    defaultLanguage='json'
                    onMount={(e) => {
                      setEditor(e)
                      e.onDidDispose(() => setEditor(null))
                    }}
                    onChange={(v) => setValue(v ?? '')}
                    onValidate={(markers) =>
                      setMarker(
                        markers[0] ? { line: markers[0].startLineNumber, column: markers[0].startColumn } : null,
                      )
                    }
                    options={{
                      wordWrap: 'on',
                      contextmenu: false,
                      tabSize: indent === '4' ? 4 : 2,
                      ariaLabel: 'JSON input',
                    }}
                  />
                </div>
              </Panel>
            </Allotment.Pane>
            <Allotment.Pane minSize={260}>
              <Panel
                title='Output'
                className='h-full rounded-none border-0 border-l'
                actions={
                  <>
                    {tree && (
                      <>
                        <Button
                          size='icon-sm'
                          variant='ghost'
                          title='Expand all'
                          aria-label='Expand all'
                          onClick={treeState.expandAll}
                          disabled={result === undefined}
                        >
                          <ChevronsUpDown />
                        </Button>
                        <Button
                          size='icon-sm'
                          variant='ghost'
                          title='Collapse all'
                          aria-label='Collapse all'
                          onClick={treeState.collapseAll}
                          disabled={result === undefined}
                        >
                          <ChevronsDownUp />
                        </Button>
                      </>
                    )}
                    <Segmented<'tree' | 'text'>
                      label='Output view'
                      value={tree ? 'tree' : 'text'}
                      onChange={(v) => setTree(v === 'tree')}
                      options={[
                        ['tree', 'Tree'],
                        ['text', 'Text'],
                      ]}
                    />
                    <CopyButton value={output} disabled={!output} size='icon-sm' label='Copy output' />
                  </>
                }
              >
                <div className='flex h-full flex-col'>
                  <label className='flex h-8 shrink-0 items-center gap-2 border-b px-2.5 text-muted-foreground focus-within:text-foreground'>
                    <Filter className='size-3.5 shrink-0' />
                    <input
                      aria-label='JSONPath query'
                      className='h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:ring-0'
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder='Filter with JSONPath, e.g. $.items[*].name'
                      spellCheck={false}
                    />
                    {queryError && (
                      <span role='alert' className='truncate text-xs text-destructive'>
                        {queryError}
                      </span>
                    )}
                  </label>
                  <div className='min-h-0 flex-1'>
                    {result === undefined ? (
                      <p className='p-2.5 text-xs text-muted-foreground'>
                        {error ? 'Fix the input to see the output' : 'Paste JSON on the left'}
                      </p>
                    ) : tree ? (
                      <JsonTree value={result} state={treeState} selected={selected} onSelect={setSelected} />
                    ) : (
                      <CodeEditor
                        value={output}
                        language='json'
                        options={{ readOnly: true, wordWrap: 'on', contextmenu: false, ariaLabel: 'JSON output' }}
                      />
                    )}
                  </div>
                </div>
              </Panel>
            </Allotment.Pane>
          </Allotment>
        </div>
        <footer className='flex h-7 shrink-0 items-center gap-3 border-t bg-muted/50 px-2.5 text-[11px] text-muted-foreground'>
          {error ? (
            <span role='alert' className='flex min-w-0'>
              <button
                type='button'
                onClick={goToError}
                className='flex min-w-0 items-center gap-1.5 text-destructive hover:underline'
                title='Go to error'
              >
                <CircleX className='size-3.5 shrink-0' />
                <span className='truncate'>
                  {error}
                  {marker && !/line \d+/.test(error) && ` (line ${marker.line}, column ${marker.column})`}
                </span>
              </button>
            </span>
          ) : (
            parsed !== undefined && (
              <span className='flex items-center gap-1.5'>
                <CircleCheck className='size-3.5 text-success' /> Valid JSON
              </span>
            )
          )}
          {showPath && (
            <span className='ml-auto flex min-w-0 items-center gap-1'>
              <code className='truncate font-mono text-foreground'>{selected}</code>
              <CopyButton value={selected} size='icon-sm' label='Copy path' className='size-5' />
            </span>
          )}
          <span className={cn('shrink-0 tabular-nums', !showPath && 'ml-auto')}>
            {lines.toLocaleString()} lines · {filesize(bytes, { base: 2 })}
          </span>
        </footer>
      </div>
    </Workspace>
  )
}

export default JsonFormatter
