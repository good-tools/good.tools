import { ArrowLeftRight, Download, Eraser, FlaskConical, FolderOpen, Sheet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ResultTable } from '@/components/ResultTable'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { DropTarget } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  cellText,
  type Delimiter,
  type JsonShape,
  parseCsv,
  type Table,
  tableFromJson,
  tableFromRows,
  tableToCsv,
  tableToJson,
  tableToSheet,
} from '@/lib/csv-json'
import { cn, downloadBlob } from '@/lib/utils'

type Mode = 'csv' | 'json' // what the input is
type View = 'table' | 'text'
interface Workbook {
  name: string
  index: number
  sheets: { sheet: string; data: unknown[][] }[]
}

const ACCEPT = '.csv,.tsv,.txt,.json,.xlsx'
const DELIMITERS: [Delimiter, string][] = [
  ['auto', 'Auto'],
  [',', 'Comma'],
  ['\t', 'Tab'],
  [';', 'Semicolon'],
  ['|', 'Pipe'],
]
const EXAMPLE = `id,name,email,active,score,zip
1,Ada Lovelace,ada@example.com,true,98.5,02134
2,Alan Turing,alan@example.com,false,87,
3,Grace Hopper,grace@example.com,true,91.25,10001
`
const PLACEHOLDER: Record<Mode, string> = {
  csv: 'Paste CSV or TSV, or open a .csv / .xlsx file…\n\nname,stars\ngood.tools,42',
  json: 'Paste JSON: an array of objects or arrays…\n\n[{ "name": "good.tools", "repo": { "stars": 42 } }]',
}

const sheetToCsv = (data: unknown[][]) => tableToCsv(tableFromRows(data, false), ',', false)
const baseName = (f: string) => f.replace(/\.[^.]+$/, '') || 'data'

export default function CsvJson() {
  const [mode, setMode] = useToolState<Mode>('csvjson:mode', 'csv')
  const [input, setInput] = useToolState('csvjson:input', '')
  const [delimiter, setDelimiter] = useToolState<Delimiter>('csvjson:delimiter', 'auto')
  const [header, setHeader] = useToolState('csvjson:header', true)
  const [infer, setInfer] = useToolState('csvjson:infer', true)
  const [shape, setShape] = useToolState<JsonShape>('csvjson:shape', 'objects')
  const [view, setView] = useToolState<View>('csvjson:view', 'table')
  const [book, setBook] = useToolState<Workbook | null>('csvjson:book', null)
  const [fileName, setFileName] = useToolState('csvjson:file', 'data')
  const [busy, setBusy] = useState('')
  const [loadError, setLoadError] = useState('')

  const result = useMemo((): { table?: Table; output: string; detected?: string; error?: string } => {
    if (!input.trim()) return { output: '' }
    try {
      if (mode === 'csv') {
        const { table, delimiter: detected } = parseCsv(input, { delimiter, header, infer })
        return { table, output: tableToJson(table, shape, header), detected }
      }
      const table = tableFromJson(JSON.parse(input), header)
      return { table, output: tableToCsv(table, delimiter === 'auto' ? ',' : delimiter, header) }
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : String(e) }
    }
  }, [input, mode, delimiter, header, infer, shape])
  const { table } = result

  const outExt = mode === 'json' ? (delimiter === '\t' ? 'tsv' : 'csv') : 'json'
  const outName = outExt.toUpperCase()

  const typed = (text: string) => {
    setInput(text)
    setBook(null)
  }

  const load = async (file: File) => {
    setLoadError('')
    setFileName(baseName(file.name))
    try {
      if (/\.xlsx$/i.test(file.name)) {
        setBusy('Reading workbook…')
        const { default: readXlsx } = await import('read-excel-file/browser')
        const sheets = (await readXlsx(file)) as Workbook['sheets']
        const [first] = sheets
        if (!first) throw new Error('The workbook has no sheets')
        setMode('csv')
        setBook({ name: file.name, index: 0, sheets })
        setInput(sheetToCsv(first.data))
        setDelimiter('auto')
        return
      }
      if (/\.xls$/i.test(file.name)) throw new Error('Old .xls workbooks are not supported; save as .xlsx or CSV')
      const text = await file.text()
      setMode(/\.json$/i.test(file.name) || /^\s*[[{]/.test(text) ? 'json' : 'csv')
      typed(text)
    } catch (e) {
      setLoadError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy('')
    }
  }

  const pickSheet = (i: number) => {
    const s = book?.sheets[i]
    if (!s) return
    setBook({ ...book, index: i })
    setInput(sheetToCsv(s.data))
    setFileName(`${baseName(book.name)}-${s.sheet}`)
  }

  const swap = () => {
    setMode(mode === 'csv' ? 'json' : 'csv')
    if (result.output) typed(result.output)
  }

  const downloadXlsx = async () => {
    if (!table) return
    setBusy('Writing workbook…')
    try {
      const { default: writeXlsx } = await import('write-excel-file/browser')
      // biome-ignore lint/suspicious/noExplicitAny: tableToSheet only yields cell values the library accepts
      const blob = await writeXlsx(tableToSheet(table, header) as any, { sheet: 'Sheet1' }).toBlob()
      downloadBlob(blob, `${fileName}.xlsx`)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <Workspace
      toolbar={
        <>
          <Segmented<Mode>
            label='Direction'
            value={mode}
            onChange={setMode}
            options={[
              ['csv', 'CSV → JSON'],
              ['json', 'JSON → CSV'],
            ]}
          />
          <Button size='sm' variant='ghost' onClick={swap} aria-label='Swap direction' title='Swap direction'>
            <ArrowLeftRight />
          </Button>
          <FileButton
            size='sm'
            variant='ghost'
            accept={ACCEPT}
            onFileSelected={(e) => e.target.files?.[0] && load(e.target.files[0])}
          >
            <FolderOpen /> Open file
          </FileButton>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => {
              setMode('csv')
              setFileName('people')
              typed(EXAMPLE)
            }}
          >
            <FlaskConical /> Example
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => {
              typed('')
              setFileName('data')
            }}
            disabled={!input}
          >
            <Eraser /> Clear
          </Button>
          {busy && <Spinner label={busy} />}
          <div className='ml-auto flex flex-wrap items-center gap-3'>
            <select
              aria-label='Delimiter'
              className={cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')}
              value={mode === 'json' && delimiter === 'auto' ? ',' : delimiter}
              onChange={(e) => setDelimiter(e.target.value as Delimiter)}
            >
              {DELIMITERS.filter(([v]) => mode === 'csv' || v !== 'auto').map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                  {v === 'auto' && result.detected ? ` (${nameOf(result.detected)})` : ''}
                </option>
              ))}
            </select>
            <Checkbox
              title='Header row'
              description='First row holds column names'
              checked={header}
              onChange={(e) => setHeader(e.target.checked)}
            />
            {mode === 'csv' && (
              <>
                <Checkbox
                  title='Infer types'
                  description='Numbers, true/false and empty/null cells become JSON values instead of strings'
                  checked={infer}
                  onChange={(e) => setInfer(e.target.checked)}
                />
                <Segmented<JsonShape>
                  label='JSON shape'
                  value={shape}
                  onChange={setShape}
                  options={[
                    ['objects', 'Objects'],
                    ['arrays', 'Arrays'],
                  ]}
                />
              </>
            )}
          </div>
        </>
      }
    >
      <Alert className='font-mono text-xs whitespace-pre-wrap'>{result.error || loadError}</Alert>
      <Split>
        <Panel
          title={mode === 'csv' ? (book ? book.name : 'CSV') : 'JSON'}
          actions={
            book && book.sheets.length > 1 ? (
              <select
                aria-label='Sheet'
                className={cn(fieldClass, 'h-6 w-auto py-0 pr-8 text-xs')}
                value={book.index}
                onChange={(e) => pickSheet(Number(e.target.value))}
              >
                {book.sheets.map((s, i) => (
                  <option key={s.sheet} value={i}>
                    {s.sheet}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        >
          <DropTarget className='h-full' label='Drop to open' onFiles={(f) => f[0] && load(f[0])}>
            <Textarea
              autoFocus
              aria-label={mode === 'csv' ? 'CSV input' : 'JSON input'}
              className={paneField}
              value={input}
              onChange={(e) => typed(e.target.value)}
              placeholder={PLACEHOLDER[mode]}
              spellCheck={false}
            />
          </DropTarget>
        </Panel>
        <Panel
          title={
            table
              ? `${table.rows.length.toLocaleString()} row${table.rows.length === 1 ? '' : 's'} · ${table.columns.length} col${table.columns.length === 1 ? '' : 's'}`
              : outName
          }
          actions={
            <>
              <Segmented<View>
                label='Output view'
                value={view}
                onChange={setView}
                options={[
                  ['table', 'Table'],
                  ['text', outName],
                ]}
              />
              <CopyButton value={result.output} disabled={!result.output} />
              <Button
                size='sm'
                variant='ghost'
                disabled={!result.output}
                onClick={() =>
                  downloadBlob(
                    result.output,
                    `${fileName}.${outExt}`,
                    outExt === 'json' ? 'application/json' : 'text/csv',
                  )
                }
              >
                <Download /> .{outExt}
              </Button>
              <Button size='sm' variant='ghost' disabled={!table || !!busy} onClick={downloadXlsx}>
                <Sheet /> .xlsx
              </Button>
            </>
          }
        >
          {view === 'table' ? (
            table ? (
              <ResultTable
                columns={table.columns}
                numRows={table.rows.length}
                cell={(r, c) => cellText(table.rows[r]?.[c])}
              />
            ) : (
              <p className='p-2.5 text-[13px] text-muted-foreground'>A preview of the rows appears here</p>
            )
          ) : (
            <Textarea
              readOnly
              aria-label={`${outName} output`}
              className={paneField}
              value={result.output}
              placeholder='Result appears here as you type'
              spellCheck={false}
            />
          )}
        </Panel>
      </Split>
    </Workspace>
  )
}

const nameOf = (d: string) => DELIMITERS.find(([v]) => v === d)?.[1] ?? d
