import { useEffect, useState } from 'react'
import { md } from 'node-forge'
import { Eraser } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/input'
import { Panel, Split, Workspace, paneField } from '@/components/ui/toolbar'

const SUBTLE = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
const ALGORITHMS = ['MD5', ...SUBTLE] as const
type Hashes = Partial<Record<(typeof ALGORITHMS)[number], string>>

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

async function hashAll(input: string): Promise<Hashes> {
  const bytes = new TextEncoder().encode(input)
  const digests = await Promise.all(SUBTLE.map((a) => crypto.subtle.digest(a, bytes)))
  // Web Crypto has no MD5; node-forge needs explicit 'utf8' or it hashes UTF-16 code units truncated to bytes.
  return {
    MD5: md.md5.create().update(input, 'utf8').digest().toHex(),
    ...Object.fromEntries(SUBTLE.map((a, i) => [a, toHex(digests[i]!)])),
  }
}

function HashCalculator() {
  const [input, setInput] = useState('')
  const [upper, setUpper] = useState(false)
  const [hashes, setHashes] = useState<Hashes>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true // drop results of superseded (stale) async hashes
    hashAll(input)
      .then((h) => {
        if (!current) return
        setHashes(h)
        setError('')
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : 'Hashing failed')
      })
    return () => {
      current = false
    }
  }, [input])

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' variant='ghost' onClick={() => setInput('')} disabled={!input}>
            <Eraser /> Clear
          </Button>
          <Checkbox
            className='ml-auto'
            title='Uppercase'
            checked={upper}
            onChange={(e) => setUpper(e.target.checked)}
          />
        </>
      }
    >
      <Alert>{error}</Alert>
      <Split>
        <Panel title='Input (UTF-8)'>
          <Textarea
            autoFocus
            aria-label='Input'
            className={paneField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='The quick brown fox'
          />
        </Panel>
        <Panel title='Digests'>
          <dl className='text-xs'>
            {ALGORITHMS.map((a) => {
              const v = upper ? (hashes[a] ?? '').toUpperCase() : (hashes[a] ?? '')
              return (
                <div key={a} className='flex min-h-8 items-start gap-2 border-b py-1.5 pr-1 pl-2.5'>
                  <dt className='w-16 shrink-0 pt-0.5 font-medium text-muted-foreground'>{a}</dt>
                  <dd id={`hash-${a}`} title={v} className='min-w-0 flex-1 pt-0.5 font-mono break-all'>
                    {v}
                  </dd>
                  <CopyButton size='icon-sm' className='-my-1' label={`Copy ${a}`} value={v} disabled={!v} />
                </div>
              )
            })}
          </dl>
        </Panel>
      </Split>
    </Workspace>
  )
}

export default HashCalculator
