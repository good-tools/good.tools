import { Eraser } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Input, Textarea } from '@/components/ui/input'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { MAX_MATCHES, type RegexResult } from '@/lib/regex'
import type { RegexRequest } from '@/workers/regex.worker'

const FLAGS: [string, string][] = [
  ['g', 'global: find all matches'],
  ['i', 'ignore case'],
  ['m', 'multiline: ^ and $ match at line breaks'],
  ['s', 'dotAll: . matches newlines'],
  ['u', 'unicode'],
  ['y', 'sticky: match only at lastIndex'],
]
const TIMEOUT_MS = 1000
const EMPTY: RegexResult = { groupNames: [], matches: [], truncated: false }

export default function RegexTester() {
  const [pattern, setPattern] = useToolState('regex:pattern', '(?<user>[\\w.]+)@(\\w+)\\.com')
  const [flags, setFlags] = useToolState('regex:flags', 'g')
  const [text, setText] = useToolState('regex:text', 'Contact alice@example.com or bob.smith@test.com')
  const [replacement, setReplacement] = useToolState('regex:replacement', '$<user> at $2')
  const [result, setResult] = useState<RegexResult>(EMPTY)
  const worker = useRef<Worker | null>(null)

  useEffect(() => {
    if (!pattern) return setResult(EMPTY)
    const w = worker.current ?? new Worker(new URL('../workers/regex.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    let done = false
    // A catastrophic (exponential backtracking) pattern can't be interrupted, so kill the worker instead.
    const kill = () => {
      w.terminate()
      if (worker.current === w) worker.current = null
    }
    const timer = setTimeout(() => {
      kill()
      done = true
      setResult({
        ...EMPTY,
        error: `Matching took longer than ${TIMEOUT_MS / 1000} s and was stopped. The pattern probably backtracks catastrophically, e.g. (a+)+$.`,
      })
    }, TIMEOUT_MS)
    w.onmessage = (e: MessageEvent<RegexResult>) => {
      done = true
      clearTimeout(timer)
      setResult(e.data)
    }
    w.postMessage({ pattern, flags, text, replacement } satisfies RegexRequest)
    return () => {
      clearTimeout(timer)
      if (!done) kill()
    }
  }, [pattern, flags, text, replacement])

  useEffect(() => () => worker.current?.terminate(), [])

  const toggle = (f: string) => setFlags((cur) => (cur.includes(f) ? cur.replace(f, '') : cur + f))

  // Highlighted test text: alternate between two shades so adjacent matches stay distinguishable.
  const parts: React.ReactNode[] = []
  let pos = 0
  result.matches.forEach((m, i) => {
    if (m.index < pos || !m.text) return
    parts.push(text.slice(pos, m.index))
    parts.push(
      <mark
        key={m.index}
        className={
          i % 2 ? 'rounded-sm bg-foreground/25 text-foreground' : 'rounded-sm bg-foreground/15 text-foreground'
        }
      >
        {m.text}
      </mark>,
    )
    pos = m.index + m.text.length
  })
  parts.push(text.slice(pos))

  const count = result.matches.length

  return (
    <Workspace
      toolbar={
        <>
          <div className='flex min-w-64 flex-1 items-center gap-1 font-mono text-[13px] text-muted-foreground'>
            /
            <Input
              autoFocus
              aria-label='Pattern'
              className='h-7 font-mono'
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder='Regular expression, e.g. \d+'
            />
            /{flags}
          </div>
          {FLAGS.map(([f, description]) => (
            <Checkbox
              key={f}
              title={f}
              description={description}
              aria-label={`Flag ${f} (${description})`}
              className='font-mono'
              checked={flags.includes(f)}
              onChange={() => toggle(f)}
            />
          ))}
        </>
      }
    >
      <Alert>{result.error}</Alert>
      <Alert variant='info'>{result.truncated && `Showing the first ${MAX_MATCHES.toLocaleString()} matches.`}</Alert>
      <Split>
        <div className='grid min-h-0 grid-rows-2 gap-2'>
          <Panel
            title='Test text'
            actions={
              <Button size='sm' variant='ghost' onClick={() => setText('')} disabled={!text}>
                <Eraser /> Clear
              </Button>
            }
          >
            <Textarea
              aria-label='Test text'
              className={paneField}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Text to match against'
            />
          </Panel>
          <Panel title='Replace' actions={<CopyButton value={result.replaced ?? ''} disabled={!result.replaced} />}>
            <div className='flex h-full flex-col'>
              <Input
                aria-label='Replacement'
                className='shrink-0 rounded-none border-0 border-b font-mono focus:ring-0'
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder='Replacement, e.g. $1 or $<name>'
              />
              <pre className='flex-1 overflow-auto p-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap'>
                {result.replaced}
              </pre>
            </div>
          </Panel>
        </div>
        <div className='grid min-h-0 grid-rows-2 gap-2'>
          <Panel title={`Highlighted · ${count} match${count === 1 ? '' : 'es'}`}>
            <pre className='p-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap'>{parts}</pre>
          </Panel>
          <Panel
            title='Matches'
            actions={<CopyButton value={() => result.matches.map((m) => m.text).join('\n')} disabled={!count} />}
          >
            <table className='w-full text-xs'>
              <tbody>
                {result.matches.slice(0, 500).map((m, i) => (
                  <Fragment key={m.index}>
                    <tr className='border-t first:border-0'>
                      <th className='w-24 px-2.5 py-1 text-left font-medium text-muted-foreground'>
                        #{i + 1} @{m.index}
                      </th>
                      <td className='px-2.5 py-1 font-mono break-all'>
                        {m.text || <i className='text-muted-foreground'>empty</i>}
                      </td>
                    </tr>
                    {m.groups.map((g, j) => (
                      <tr key={j} className='text-muted-foreground'>
                        <th className='px-2.5 pl-6 text-left font-normal'>
                          ${j + 1}
                          {result.groupNames[j] && ` <${result.groupNames[j]}>`}
                        </th>
                        <td className='px-2.5 font-mono break-all text-foreground'>
                          {g ?? <i className='text-muted-foreground'>undefined</i>}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {count > 500 && <p className='px-2.5 py-1 text-xs text-muted-foreground'>…and {count - 500} more</p>}
          </Panel>
        </div>
      </Split>
    </Workspace>
  )
}
