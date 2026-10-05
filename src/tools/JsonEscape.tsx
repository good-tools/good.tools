import { ArrowLeftRight, Eraser } from 'lucide-react'
import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useJsonEscapeStore } from '@/stores'
import type { JsonEscapeMode } from '@/stores/json-escape.store'

function JsonEscape() {
  const { mode, input, setMode, setInput } = useJsonEscapeStore()

  const result = useMemo((): { output: string; error?: string } => {
    if (mode === 'escape') return { output: JSON.stringify(input).slice(1, -1) }
    try {
      return { output: JSON.parse(`"${input}"`) as string }
    } catch (e) {
      return { output: '', error: `Not a valid JSON string body: ${e instanceof Error ? e.message : String(e)}` }
    }
  }, [input, mode])

  const swap = () => {
    setMode(mode === 'escape' ? 'unescape' : 'escape')
    setInput(result.output)
  }

  return (
    <Workspace
      toolbar={
        <>
          <Segmented<JsonEscapeMode>
            label='Mode'
            value={mode}
            onChange={setMode}
            options={[
              ['escape', 'Escape'],
              ['unescape', 'Unescape'],
            ]}
          />
          <Button size='sm' variant='ghost' onClick={swap} disabled={!result.output}>
            <ArrowLeftRight /> Swap
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setInput('')} disabled={!input}>
            <Eraser /> Clear
          </Button>
        </>
      }
    >
      <Alert>{result.error}</Alert>
      <Split>
        <Panel title={mode === 'escape' ? 'Text' : 'Escaped'}>
          <Textarea
            autoFocus
            aria-label='Input'
            className={paneField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'escape' ? 'Paste text, e.g. He said "hi"' : 'Paste a JSON string body, e.g. a\\"b\\n'
            }
          />
        </Panel>
        <Panel
          title={mode === 'escape' ? 'Escaped' : 'Text'}
          actions={<CopyButton value={result.output} disabled={!result.output} />}
        >
          <Textarea
            readOnly
            aria-label='Output'
            className={paneField}
            value={result.output}
            placeholder='Result appears here as you type'
          />
        </Panel>
      </Split>
    </Workspace>
  )
}

export default JsonEscape
