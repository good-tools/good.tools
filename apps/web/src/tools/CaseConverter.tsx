import { Eraser } from 'lucide-react'
import { useDeferredValue } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/input'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { CASES, convertCase } from '@/lib/case'

export default function CaseConverter() {
  const [text, setText] = useToolState('case-converter:text', '')
  const [perLine, setPerLine] = useToolState('case-converter:per-line', true)
  const deferred = useDeferredValue(text)

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' variant='ghost' onClick={() => setText('')} disabled={!text}>
            <Eraser /> Clear
          </Button>
          <Checkbox
            title='Per line'
            description='Convert each line separately, e.g. a list of names'
            checked={perLine}
            onChange={(e) => setPerLine(e.target.checked)}
          />
        </>
      }
    >
      <Split>
        <Panel title='Text'>
          <Textarea
            autoFocus
            aria-label='Text'
            className={paneField}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Type or paste text, e.g. XMLHttpRequest or the quick brown fox…'
          />
        </Panel>
        <Panel title='Conversions'>
          <dl className='text-[13px]'>
            {CASES.map(({ id, label }) => {
              const value = convertCase(id, deferred, perLine)
              return (
                <div key={id} className='flex min-h-8 items-start gap-2 border-b py-1 pr-1 pl-2.5 last:border-0'>
                  <dt className='w-32 shrink-0 pt-1 text-muted-foreground'>{label}</dt>
                  <dd className='min-w-0 flex-1 pt-1 font-mono break-all whitespace-pre-wrap'>{value}</dd>
                  <CopyButton value={value} size='icon-sm' label={`Copy ${label}`} disabled={!value} />
                </div>
              )
            })}
          </dl>
        </Panel>
      </Split>
    </Workspace>
  )
}
