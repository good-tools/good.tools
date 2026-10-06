import type { Monaco, OnMount } from '@monaco-editor/react'
import { Allotment } from 'allotment'
import { useEffect, useState } from 'react'
import 'allotment/dist/style.css'
import { filesize } from 'filesize'
import { CircleX, Eraser, FileCode } from 'lucide-react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CodeEditor } from '@/components/ui/code-editor'
import { CopyButton } from '@/components/ui/copy-button'
import { fieldClass } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  beautify,
  CodeError,
  canMinify,
  EXAMPLES,
  type Indent,
  LANGUAGES,
  type Language,
  minify,
  SQL_DIALECTS,
  type SqlDialect,
} from '@/lib/code-format'
import { cn } from '@/lib/utils'

type Mode = 'beautify' | 'minify'
type Result = { output: string; error?: CodeError; busy: boolean }

const bytes = (s: string) => new TextEncoder().encode(s).length
const size = (s: string) => filesize(bytes(s), { base: 2 })
const shortNames: [Language, string][] = [
  ['javascript', 'JS'],
  ['typescript', 'TS'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['scss', 'SCSS'],
  ['sql', 'SQL'],
]

export default function CodeFormatter() {
  const [input, setInput] = useToolState('code-formatter:input', '')
  const [lang, setLang] = useToolState<Language>('code-formatter:lang', 'javascript')
  const [mode, setMode] = useToolState<Mode>('code-formatter:mode', 'beautify')
  const [indent, setIndent] = useToolState<Indent>('code-formatter:indent', '2')
  const [dialect, setDialect] = useToolState<SqlDialect>('code-formatter:dialect', 'sql')
  const [result, setResult] = useState<Result>({ output: '', busy: false })
  const [editor, setEditor] = useState<{ editor: Parameters<OnMount>[0]; monaco: Monaco } | null>(null)
  const unsupported = mode === 'minify' && !canMinify(lang)

  // Live output; debounced, and stale results (slower library load, older input) are dropped
  useEffect(() => {
    if (!input.trim() || unsupported) {
      setResult({ output: '', busy: false })
      return
    }
    let stale = false
    setResult((r) => ({ ...r, busy: true }))
    const t = setTimeout(() => {
      ;(mode === 'minify' ? minify(input, lang) : beautify(input, lang, indent, dialect)).then(
        (output) => !stale && setResult({ output, busy: false }),
        (e: unknown) =>
          !stale &&
          setResult({ output: '', busy: false, error: e instanceof CodeError ? e : new CodeError(String(e)) }),
      )
    }, 250)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [input, lang, mode, indent, dialect, unsupported])

  // Underline the parse error in the input
  const { error } = result
  useEffect(() => {
    const model = editor?.editor.getModel()
    if (!editor || !model) return
    const at = error?.line ? { line: error.line, column: error.column ?? 1 } : null
    editor.monaco.editor.setModelMarkers(
      model,
      'code-formatter',
      at
        ? [
            {
              severity: editor.monaco.MarkerSeverity.Error,
              message: error?.message ?? '',
              startLineNumber: at.line,
              startColumn: at.column,
              endLineNumber: at.line,
              endColumn: at.column + 1,
            },
          ]
        : [],
    )
  }, [editor, error])

  const goToError = () => {
    if (!editor || !error?.line) return
    const pos = { lineNumber: error.line, column: error.column ?? 1 }
    editor.editor.revealPositionInCenter(pos)
    editor.editor.setPosition(pos)
    editor.editor.focus()
  }

  const inBytes = bytes(input)
  const outBytes = bytes(result.output)

  return (
    <Workspace
      toolbar={
        <>
          <Segmented<Language> label='Language' value={lang} onChange={setLang} options={shortNames} />
          <Segmented<Mode>
            label='Mode'
            value={mode}
            onChange={setMode}
            options={[
              ['beautify', 'Beautify'],
              ['minify', 'Minify'],
            ]}
          />
          {mode === 'beautify' && (
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
          )}
          {lang === 'sql' && (
            <select
              aria-label='SQL dialect'
              className={cn(fieldClass, 'h-7 w-36 py-0 text-xs')}
              value={dialect}
              onChange={(e) => setDialect(e.target.value as SqlDialect)}
            >
              {Object.entries(SQL_DIALECTS).map(([v, name]) => (
                <option key={v} value={v}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <Button size='sm' variant='ghost' onClick={() => setInput(EXAMPLES[lang])}>
            <FileCode /> Example
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setInput('')} disabled={!input}>
            <Eraser /> Clear
          </Button>
          <span className='ml-auto text-xs text-muted-foreground'>
            JSON or XML? Use the{' '}
            <Link to='/json' className='text-foreground hover:underline'>
              JSON
            </Link>{' '}
            or{' '}
            <Link to='/xml' className='text-foreground hover:underline'>
              XML Formatter
            </Link>
          </span>
        </>
      }
    >
      <Alert variant='info'>
        {unsupported && `There is no ${LANGUAGES[lang]} minifier here; only JavaScript, HTML and CSS can be minified.`}
      </Alert>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card'>
        <div className='min-h-0 flex-1'>
          <Allotment>
            <Allotment.Pane minSize={260}>
              <Panel title='Input' className='h-full rounded-none border-0'>
                <CodeEditor
                  value={input}
                  language={lang}
                  onMount={(e, monaco) => {
                    setEditor({ editor: e, monaco })
                    e.onDidDispose(() => setEditor(null))
                  }}
                  onChange={(v) => setInput(v ?? '')}
                  options={{
                    wordWrap: 'on',
                    contextmenu: false,
                    tabSize: indent === '4' ? 4 : 2,
                    ariaLabel: `${LANGUAGES[lang]} input`,
                  }}
                />
              </Panel>
            </Allotment.Pane>
            <Allotment.Pane minSize={260}>
              <Panel
                title='Output'
                className='h-full rounded-none border-0 border-l'
                actions={
                  <>
                    {result.busy && <Spinner className='size-3.5' />}
                    <CopyButton value={result.output} disabled={!result.output} size='icon-sm' label='Copy output' />
                  </>
                }
              >
                {result.output ? (
                  <CodeEditor
                    value={result.output}
                    language={lang}
                    options={{
                      readOnly: true,
                      wordWrap: 'on',
                      contextmenu: false,
                      ariaLabel: `${LANGUAGES[lang]} output`,
                    }}
                  />
                ) : (
                  <p className='p-2.5 text-xs text-muted-foreground'>
                    {result.busy
                      ? 'Loading…'
                      : error
                        ? 'Fix the input to see the output'
                        : `Paste ${LANGUAGES[lang]} on the left`}
                  </p>
                )}
              </Panel>
            </Allotment.Pane>
          </Allotment>
        </div>
        <footer className='flex h-7 shrink-0 items-center gap-3 border-t bg-muted/50 px-2.5 text-[11px] text-muted-foreground'>
          {error && (
            <span role='alert' className='flex min-w-0'>
              <button
                type='button'
                onClick={goToError}
                disabled={!error.line}
                className='flex min-w-0 items-center gap-1.5 text-destructive enabled:hover:underline'
                title={error.line ? 'Go to error' : undefined}
              >
                <CircleX className='size-3.5 shrink-0' />
                <span className='truncate'>
                  {error.message}
                  {error.line && ` (line ${error.line}, column ${error.column ?? 1})`}
                </span>
              </button>
            </span>
          )}
          {result.output && (
            <span className='ml-auto shrink-0 tabular-nums' data-testid='sizes'>
              {size(input)} → {size(result.output)}
              {inBytes > 0 &&
                ` (${outBytes <= inBytes ? '−' : '+'}${Math.abs(Math.round((1 - outBytes / inBytes) * 100))}%)`}
            </span>
          )}
        </footer>
      </div>
    </Workspace>
  )
}
