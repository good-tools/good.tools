import { ArrowLeftRight, Eraser } from 'lucide-react'
import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { cn } from '@/lib/utils'
import { useURLStore } from '@/stores'
import type { URLMode } from '@/stores/url.store'

function URL() {
  const { mode, input, plusAsSpace, setMode, setInput, setPlusAsSpace } = useURLStore()

  const result = useMemo((): { output: string; error?: string } => {
    if (mode === 'encode') return { output: encodeURIComponent(input) }
    try {
      return { output: decodeURIComponent(plusAsSpace ? input.replace(/\+/g, ' ') : input) }
    } catch {
      return {
        output: '',
        error: 'Malformed percent-encoding: every "%" must be followed by two hex digits forming valid UTF-8.',
      }
    }
  }, [input, mode, plusAsSpace])

  const swap = () => {
    setMode(mode === 'encode' ? 'decode' : 'encode')
    setInput(result.output)
  }

  return (
    <Workspace
      toolbar={
        <>
          <Segmented<URLMode>
            label='Mode'
            value={mode}
            onChange={setMode}
            options={[
              ['encode', 'Encode'],
              ['decode', 'Decode'],
            ]}
          />
          <Button size='sm' variant='ghost' onClick={swap} disabled={!result.output}>
            <ArrowLeftRight /> Swap
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setInput('')} disabled={!input}>
            <Eraser /> Clear
          </Button>
          {mode === 'decode' && (
            <Checkbox
              className='ml-auto'
              checked={plusAsSpace}
              onChange={(e) => setPlusAsSpace(e.target.checked)}
              title='Treat + as space'
              description='Decode form data (application/x-www-form-urlencoded), where spaces are encoded as +'
            />
          )}
        </>
      }
    >
      <Alert>{result.error}</Alert>
      <Split>
        <Panel title={mode === 'encode' ? 'Text' : 'URL-encoded'}>
          <Textarea
            autoFocus
            aria-label={mode === 'encode' ? 'Text to encode' : 'URL-encoded text to decode'}
            className={paneField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'encode' ? 'Type or paste text…' : 'Paste URL-encoded text, e.g. a%20b%26c'}
          />
        </Panel>
        <Panel
          title={mode === 'encode' ? 'URL-encoded' : 'Text'}
          actions={<CopyButton value={result.output} disabled={!result.output} />}
        >
          <Textarea
            readOnly
            aria-label='Result'
            className={cn(paneField, 'break-all')}
            value={result.output}
            placeholder='Result appears here as you type'
          />
        </Panel>
      </Split>
    </Workspace>
  )
}

export default URL
