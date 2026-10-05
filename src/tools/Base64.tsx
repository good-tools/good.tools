import { useMemo, useState } from 'react'
import { ArrowLeftRight, Eraser } from 'lucide-react'
import { Buffer } from 'buffer'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/input'
import { Panel, Split, Workspace, paneField } from '@/components/ui/toolbar'
import { Segmented } from '@/components/ui/segmented'
import { useBase64Store, type Base64Mode } from '@/stores/base64.store'
import { cn } from '@/lib/utils'

/** Buffer.from(s, 'base64') silently drops invalid characters, so validate first (standard or URL-safe alphabet). */
export function parseBase64(input: string): Buffer {
  const s = input.replace(/\s+/g, '')
  const bad = s.search(/[^A-Za-z0-9+/\-_=]/)
  if (bad >= 0) throw new Error(`Invalid base64 character "${s[bad]}" at position ${bad + 1}`)
  if (!/^[^=]*={0,2}$/.test(s) || s.replace(/=+$/, '').length % 4 === 1)
    throw new Error('Invalid base64 length or padding')
  return Buffer.from(s, 'base64')
}

const utf8 = new TextDecoder('utf-8', { fatal: true })
type View = 'text' | 'hex'

export default function Base64() {
  const { mode, input, urlSafe, setMode, setInput, setUrlSafe } = useBase64Store()
  const [view, setView] = useState<View>('text')

  const result = useMemo((): { output: string; error?: string; binary?: boolean } => {
    if (!input) return { output: '' }
    if (mode === 'encode') {
      const b64 = Buffer.from(input, 'utf8').toString('base64')
      return { output: urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64 }
    }
    try {
      const buf = parseBase64(input)
      if (view === 'hex') return { output: buf.toString('hex').replace(/(..)(?!$)/g, '$1 ') }
      try {
        return { output: utf8.decode(buf) }
      } catch {
        return { output: buf.toString('hex').replace(/(..)(?!$)/g, '$1 '), binary: true }
      }
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : String(e) }
    }
  }, [input, mode, urlSafe, view])

  const swap = () => {
    if (result.error || result.binary) return
    setMode(mode === 'encode' ? 'decode' : 'encode')
    setInput(result.output)
  }

  return (
    <Workspace
      toolbar={
        <>
          <Segmented<Base64Mode>
            label='Mode'
            value={mode}
            onChange={setMode}
            options={[
              ['encode', 'Encode'],
              ['decode', 'Decode'],
            ]}
          />
          <Button size='sm' variant='ghost' onClick={swap} disabled={!result.output || !!result.binary}>
            <ArrowLeftRight /> Swap
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setInput('')} disabled={!input}>
            <Eraser /> Clear
          </Button>
          <div className='ml-auto'>
            {mode === 'encode' ? (
              <Checkbox title='URL-safe' checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} />
            ) : (
              <Segmented<View>
                label='Output format'
                value={view}
                onChange={setView}
                options={[
                  ['text', 'Text'],
                  ['hex', 'Hex'],
                ]}
              />
            )}
          </div>
        </>
      }
    >
      <Alert>{result.error}</Alert>
      <Alert variant='info'>{result.binary && 'Decoded data is not valid UTF-8 text; showing hex bytes.'}</Alert>
      <Split>
        <Panel title={mode === 'encode' ? 'Text' : 'Base64'}>
          <Textarea
            autoFocus
            aria-label={mode === 'encode' ? 'Text to encode' : 'Base64 to decode'}
            className={paneField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'encode' ? 'Type or paste text…' : 'Paste base64, e.g. SGVsbG8sIFdvcmxkIQ=='}
          />
        </Panel>
        <Panel
          title={mode === 'encode' ? 'Base64' : result.binary || view === 'hex' ? 'Hex' : 'Text'}
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
