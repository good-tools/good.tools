import { Eraser } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { formatDuration, keywordDensity, sentenceWords, textStats } from '@/lib/text-stats'

type N = '1' | '2' | '3'

const num = new Intl.NumberFormat()
const pct = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

export default function WordCounter() {
  const [text, setText] = useToolState('word-counter:text', '')
  const [n, setN] = useToolState<N>('word-counter:n', '1')
  const [excludeStop, setExcludeStop] = useToolState('word-counter:exclude-stop', true)
  // Keeps typing responsive on long texts: stats catch up a frame later
  const deferred = useDeferredValue(text)

  const sentences = useMemo(() => sentenceWords(deferred), [deferred])
  const stats = useMemo(() => textStats(deferred, sentences), [deferred, sentences])
  const keywords = useMemo(
    () => keywordDensity(sentences, Number(n) as 1 | 2 | 3, excludeStop),
    [sentences, n, excludeStop],
  )

  const rows: [string, string][] = [
    ['Words', num.format(stats.words)],
    ['Characters', num.format(stats.characters)],
    ['Without spaces', num.format(stats.charactersNoSpaces)],
    ['Sentences', num.format(stats.sentences)],
    ['Paragraphs', num.format(stats.paragraphs)],
    ['Lines', num.format(stats.lines)],
    ['Unique words', num.format(stats.uniqueWords)],
    ['Avg word length', stats.averageWordLength.toFixed(1)],
    ['Reading time', formatDuration(stats.readingTime)],
    ['Speaking time', formatDuration(stats.speakingTime)],
  ]

  return (
    <Workspace
      toolbar={
        <Button size='sm' variant='ghost' onClick={() => setText('')} disabled={!text}>
          <Eraser /> Clear
        </Button>
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
            placeholder='Type or paste text…'
          />
        </Panel>
        <div className='flex min-h-0 flex-col gap-2'>
          <Panel title='Statistics' className='shrink-0'>
            <dl className='grid grid-cols-2 text-[13px]'>
              {rows.map(([label, value]) => (
                <div key={label} className='flex h-8 items-center justify-between gap-2 border-b px-2.5 odd:border-r'>
                  <dt className='text-muted-foreground'>{label}</dt>
                  <dd className='font-mono tabular-nums'>{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel
            title='Keyword density'
            className='flex-1'
            actions={
              <>
                <Checkbox
                  title='Exclude stop words'
                  description='Skip common English words such as "the" and "of"'
                  checked={excludeStop}
                  onChange={(e) => setExcludeStop(e.target.checked)}
                />
                <Segmented<N>
                  label='Phrase length'
                  value={n}
                  onChange={setN}
                  options={[
                    ['1', '1 word'],
                    ['2', '2 words'],
                    ['3', '3 words'],
                  ]}
                />
              </>
            }
          >
            {keywords.length ? (
              <table className='w-full text-[13px]'>
                <thead className='sticky top-0 bg-card text-[11px] text-muted-foreground'>
                  <tr className='h-7 border-b'>
                    <th className='px-2.5 text-left font-medium'>Keyword</th>
                    <th className='w-20 px-2.5 text-right font-medium'>Count</th>
                    <th className='w-20 px-2.5 text-right font-medium'>Density</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((k) => (
                    <tr key={k.phrase} className='h-7 border-b last:border-0'>
                      <td className='px-2.5 break-all'>{k.phrase}</td>
                      <td className='px-2.5 text-right font-mono tabular-nums'>{num.format(k.count)}</td>
                      <td className='px-2.5 text-right font-mono tabular-nums'>{pct.format(k.density)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className='p-2.5 text-[13px] text-muted-foreground'>Keywords appear here as you type</p>
            )}
          </Panel>
        </div>
      </Split>
    </Workspace>
  )
}
