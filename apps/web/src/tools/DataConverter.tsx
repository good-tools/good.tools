import { ArrowLeftRight, Eraser } from 'lucide-react'
import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { convertData, type DataFormat } from '@/lib/convert'

const FORMATS: [DataFormat, string][] = [
  ['json', 'JSON'],
  ['yaml', 'YAML'],
  ['toml', 'TOML'],
  ['csv', 'CSV'],
]
const name = (f: DataFormat) => FORMATS.find(([v]) => v === f)?.[1]

const PLACEHOLDER: Record<DataFormat, string> = {
  json: '{\n  "name": "good.tools",\n  "tags": ["local", "free"]\n}',
  yaml: 'name: good.tools\ntags:\n  - local\n  - free',
  toml: 'name = "good.tools"\ntags = ["local", "free"]',
  csv: 'name,stars\ngood.tools,42',
}

export default function DataConverter() {
  const [from, setFrom] = useToolState<DataFormat>('convert:from', 'yaml')
  const [to, setTo] = useToolState<DataFormat>('convert:to', 'json')
  const [input, setInput] = useToolState('convert:input', '')

  const result = useMemo((): { output: string; error?: string } => {
    if (!input.trim()) return { output: '' }
    try {
      return { output: convertData(input, from, to) }
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : String(e) }
    }
  }, [input, from, to])

  const swap = () => {
    setFrom(to)
    setTo(from)
    if (result.output) setInput(result.output)
  }

  return (
    <Workspace
      toolbar={
        <>
          <span className='text-xs text-muted-foreground'>From</span>
          <Segmented<DataFormat> label='From' value={from} onChange={setFrom} options={FORMATS} />
          <Button size='sm' variant='ghost' onClick={swap} aria-label='Swap formats' title='Swap formats'>
            <ArrowLeftRight />
          </Button>
          <span className='text-xs text-muted-foreground'>To</span>
          <Segmented<DataFormat> label='To' value={to} onChange={setTo} options={FORMATS} />
          <Button size='sm' variant='ghost' onClick={() => setInput('')} disabled={!input}>
            <Eraser /> Clear
          </Button>
        </>
      }
    >
      <Alert className='font-mono text-xs whitespace-pre-wrap'>{result.error}</Alert>
      <Split>
        <Panel title={name(from)}>
          <Textarea
            autoFocus
            aria-label={`${name(from)} input`}
            className={paneField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDER[from]}
          />
        </Panel>
        <Panel title={name(to)} actions={<CopyButton value={result.output} disabled={!result.output} />}>
          <Textarea
            readOnly
            aria-label={`${name(to)} output`}
            className={paneField}
            value={result.output}
            placeholder='Result appears here as you type'
          />
        </Panel>
      </Split>
    </Workspace>
  )
}
