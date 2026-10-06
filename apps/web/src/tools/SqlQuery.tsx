import { Download, FlaskConical, FolderOpen, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { ResultTable } from '@/components/ResultTable'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CodeEditor } from '@/components/ui/code-editor'
import { CopyButton } from '@/components/ui/copy-button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { isMac, Kbd } from '@/components/ui/kbd'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { cellText, listTables, loadFile, type Result, runQuery, type TableInfo, toCsv, toJson } from '@/lib/sql'
import { downloadBlob } from '@/lib/utils'

const ACCEPT = '.csv,.tsv,.txt,.json,.ndjson,.jsonl,.parquet,.db,.sqlite,.sqlite3'

const EXAMPLE_CSV = `city,country,population,area_km2,founded
Tokyo,Japan,13960000,2194,1457
Osaka,Japan,2750000,225,
Delhi,India,16790000,1484,
Mumbai,India,12440000,603,1507
Shanghai,China,24870000,6341,
Beijing,China,21540000,16411,
São Paulo,Brazil,12330000,1521,1554
Rio de Janeiro,Brazil,6750000,1200,1565
Mexico City,Mexico,9210000,1485,1325
Cairo,Egypt,10100000,3085,969
Lagos,Nigeria,15390000,1171,
New York,United States,8340000,783,1624
Los Angeles,United States,3820000,1302,1781
London,United Kingdom,8980000,1572,
Paris,France,2100000,105,
Berlin,Germany,3880000,891,1237
`
const EXAMPLE_QUERY = `-- Ctrl/Cmd+Enter runs the query
SELECT country,
  count(*) AS cities,
  sum(population) AS population,
  round(sum(population) / sum(area_km2)) AS people_per_km2
FROM cities
GROUP BY country
ORDER BY population DESC`

export default function SqlQuery() {
  const [query, setQuery] = useToolState('sql:query', '')
  const [tables, setTables] = useToolState<TableInfo[]>('sql:tables', [])
  const [result, setResult] = useToolState<{ data: Result; ms: number } | null>('sql:result', null)
  const [error, setError] = useToolState('sql:error', '')
  const [busy, setBusy] = useState('')

  const work = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setResult(null)
    } finally {
      setBusy('')
    }
  }

  const run = (sql = query) =>
    work('Running…', async () => {
      if (!sql.trim()) return
      const start = performance.now()
      const data = await runQuery(sql)
      setResult({ data, ms: performance.now() - start })
      // DDL (CREATE TABLE …) can change the table list
      setTables(await listTables())
    })
  const runRef = useRef(run)
  runRef.current = run

  const load = (files: File[], then?: string) =>
    work('Loading…', async () => {
      const names: string[] = []
      for (const f of files) names.push(await loadFile(f, setBusy))
      setTables(await listTables())
      const sql = then ?? (query.trim() ? null : `SELECT * FROM ${names[0]} LIMIT 100`)
      if (sql) {
        setQuery(sql)
        setResult(null)
        const start = performance.now()
        const data = await runQuery(sql)
        setResult({ data, ms: performance.now() - start })
      }
    })

  const exportAs = (kind: 'csv' | 'json') => {
    if (!result) return
    const text = kind === 'csv' ? toCsv(result.data) : toJson(result.data)
    downloadBlob(text, `query.${kind}`, kind === 'csv' ? 'text/csv' : 'application/json')
  }

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={() => run()} disabled={!!busy || !query.trim()}>
            <Play /> Run{' '}
            <Kbd className='border-primary-foreground/30 bg-transparent text-inherit'>{isMac ? '⌘' : 'Ctrl'}↵</Kbd>
          </Button>
          <FileButton
            size='sm'
            variant='ghost'
            accept={ACCEPT}
            multiple
            onFileSelected={(e) => load(Array.from(e.target.files ?? []))}
            disabled={!!busy}
          >
            <FolderOpen /> Open files
          </FileButton>
          <Button
            size='sm'
            variant='ghost'
            disabled={!!busy}
            onClick={() => load([new File([EXAMPLE_CSV], 'cities.csv', { type: 'text/csv' })], EXAMPLE_QUERY)}
          >
            <FlaskConical /> Load example
          </Button>
          {busy && <Spinner label={busy} />}
        </>
      }
    >
      <Alert>{error}</Alert>
      <div className='grid min-h-0 flex-1 gap-2 max-lg:grid-rows-[minmax(0,12rem)_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]'>
        <Panel title='Tables'>
          {tables.length ? (
            <DropTarget onFiles={(f) => load(f)}>
              <ul className='p-1 text-xs'>
                {tables.map((t) => (
                  <li key={t.name}>
                    <details open={tables.length < 4}>
                      <summary className='cursor-pointer rounded px-1.5 py-1 font-mono font-medium hover:bg-muted'>
                        {t.name}
                      </summary>
                      <ul className='mb-1 pl-5 font-mono'>
                        {t.columns.map((c) => (
                          <li key={c.name} className='flex justify-between gap-2 py-px pr-1.5'>
                            <span className='truncate'>{c.name}</span>
                            <span className='shrink-0 text-muted-foreground'>{c.type}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </DropTarget>
          ) : (
            <DropZone
              className='m-2'
              onFiles={(f) => load(f)}
              accept={ACCEPT}
              multiple
              disabled={!!busy}
              hint='CSV, TSV, JSON, NDJSON, Parquet or SQLite. Each file becomes a table named after it; a SQLite database becomes a schema (file.table).'
            >
              Drop files here or click to browse
            </DropZone>
          )}
        </Panel>
        <div className='grid min-h-0 grid-rows-[minmax(0,13rem)_minmax(0,1fr)] gap-2'>
          <Panel title='Query'>
            <CodeEditor
              language='sql'
              value={query}
              onChange={(v) => setQuery(v ?? '')}
              options={{ ariaLabel: 'SQL query' }}
              onMount={(editor, monaco) => {
                // Read the editor itself: `query` state can lag a keystroke typed just before Ctrl+Enter
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current(editor.getValue()))
              }}
            />
          </Panel>
          <Panel
            title={
              result
                ? `${result.data.numRows.toLocaleString()} row${result.data.numRows === 1 ? '' : 's'} · ${result.ms.toFixed(0)} ms`
                : 'Results'
            }
            actions={
              <>
                <CopyButton label='Copy CSV' value={() => (result ? toCsv(result.data) : '')} disabled={!result} />
                <Button size='sm' variant='ghost' onClick={() => exportAs('csv')} disabled={!result}>
                  <Download /> CSV
                </Button>
                <Button size='sm' variant='ghost' onClick={() => exportAs('json')} disabled={!result}>
                  <Download /> JSON
                </Button>
              </>
            }
          >
            {result ? (
              <ResultTable
                columns={result.data.columns}
                numRows={result.data.numRows}
                cell={(r, c) => cellText(result.data.get(r, c))}
              />
            ) : (
              <p className='p-2.5 text-[13px] text-muted-foreground'>Load a file and run a query to see results here</p>
            )}
          </Panel>
        </div>
      </div>
    </Workspace>
  )
}
