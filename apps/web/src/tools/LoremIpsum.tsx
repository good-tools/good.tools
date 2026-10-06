import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Input, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Panel, paneField, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { countWords, type Format, formatLorem, lorem, MAX, type Unit } from '@/lib/lorem'

const num = new Intl.NumberFormat()

export default function LoremIpsum() {
  const [unit, setUnit] = useToolState<Unit>('lorem:unit', 'paragraphs')
  // Kept as typed so the field can be emptied while editing; clamped when generating
  const [count, setCount] = useToolState('lorem:count', '3')
  const [start, setStart] = useToolState('lorem:start', true)
  const [format, setFormat] = useToolState<Format>('lorem:format', 'text')
  const [paragraphs, setParagraphs] = useToolState('lorem:paragraphs', () => lorem('paragraphs', 3, true))

  const regenerate = (u = unit, n = count, s = start) => setParagraphs(lorem(u, Number(n), s))
  const output = formatLorem(paragraphs, format)
  const words = countWords(paragraphs)

  return (
    <Workspace
      toolbar={
        <>
          <Input
            aria-label='Count'
            type='number'
            min={1}
            max={MAX[unit]}
            className='h-7 w-20'
            value={count}
            onChange={(e) => {
              setCount(e.target.value)
              if (e.target.value) regenerate(unit, e.target.value)
            }}
          />
          <Segmented<Unit>
            label='Unit'
            value={unit}
            onChange={(u) => {
              setUnit(u)
              regenerate(u)
            }}
            options={[
              ['paragraphs', 'Paragraphs'],
              ['sentences', 'Sentences'],
              ['words', 'Words'],
            ]}
          />
          <Checkbox
            title='Start with "Lorem ipsum"'
            description='Begin with the classic "Lorem ipsum dolor sit amet…"'
            checked={start}
            onChange={(e) => {
              setStart(e.target.checked)
              regenerate(unit, count, e.target.checked)
            }}
          />
          <Segmented<Format>
            label='Format'
            value={format}
            onChange={setFormat}
            options={[
              ['text', 'Plain text'],
              ['html', 'HTML'],
              ['markdown', 'Markdown'],
            ]}
          />
          <Button size='sm' onClick={() => regenerate()}>
            <RefreshCw /> Regenerate
          </Button>
        </>
      }
    >
      <Panel
        title={`${num.format(paragraphs.length)} ${paragraphs.length === 1 ? 'paragraph' : 'paragraphs'} · ${num.format(words)} words`}
        className='flex-1'
        actions={<CopyButton value={output} />}
      >
        <Textarea readOnly aria-label='Lorem ipsum' className={paneField} value={output} />
      </Panel>
    </Workspace>
  )
}
