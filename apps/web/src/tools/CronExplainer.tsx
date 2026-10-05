import { Cron } from 'croner'
import cronstrue from 'cronstrue'
import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { CopyButton } from '@/components/ui/copy-button'
import { fieldClass, Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { cn } from '@/lib/utils'

/**
 * Describes a 5-field (minute first) or 6-field (seconds first) cron expression, or a macro such as
 * `@daily`, and lists its next `count` runs after `from`, evaluated in `timeZone`.
 * Day of month and day of week are OR-ed, like Vixie cron.
 */
export function explainCron(expression: string, timeZone: string, count: number, from = new Date()) {
  const expr = expression.trim()
  const runs = new Cron(expr, { timezone: timeZone, mode: '5-or-6-parts' }).nextRuns(count, from)
  return { description: cronstrue.toString(expr, { use24HourTimeFormat: true }), runs }
}

export const formatRun = (date: Date, timeZone: string) =>
  date.toLocaleString('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  })

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
const TIME_ZONES = [...new Set(['UTC', LOCAL_TZ, ...Intl.supportedValuesOf('timeZone')])]

export default function CronExplainer() {
  const [expression, setExpression] = useToolState('cron:expression', '0 9 * * MON-FRI')
  const [tz, setTz] = useToolState('cron:tz', LOCAL_TZ)
  const [count, setCount] = useToolState('cron:count', '10')

  const result = useMemo(() => {
    if (!expression.trim()) return undefined
    try {
      return explainCron(expression, tz, Math.min(100, Math.max(1, Math.floor(Number(count)) || 10)))
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [expression, tz, count])

  return (
    <Workspace
      toolbar={
        <>
          <Input
            autoFocus
            aria-label='Cron expression'
            className='h-7 max-w-md font-mono'
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder='*/15 * * * *, 0 0 9 * * MON-FRI or @daily'
          />
          <Label htmlFor='cron-count'>Runs</Label>
          <Input
            id='cron-count'
            type='number'
            min={1}
            max={100}
            className='h-7 w-20'
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
          <div className='ml-auto flex items-center gap-2'>
            <Label htmlFor='cron-tz'>Time zone</Label>
            <select
              id='cron-tz'
              className={cn(fieldClass, 'h-7 w-56 py-0 text-xs')}
              value={tz}
              onChange={(e) => setTz(e.target.value)}
            >
              {TIME_ZONES.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </div>
        </>
      }
    >
      {result && 'error' in result ? (
        <Alert>{result.error}</Alert>
      ) : (
        result && (
          <div className='flex max-w-3xl min-h-0 flex-col gap-2'>
            <Panel title='Description' actions={<CopyButton value={result.description} />}>
              <p className='px-2.5 py-2 text-sm'>{result.description}</p>
            </Panel>
            <Panel
              title={`Next runs · ${tz}`}
              actions={
                <CopyButton
                  value={() => result.runs.map((d) => d.toISOString()).join('\n')}
                  label='Copy ISO'
                  disabled={!result.runs.length}
                />
              }
            >
              {result.runs.length ? (
                <table className='w-full text-xs'>
                  <tbody>
                    {result.runs.map((d, i) => (
                      <tr key={d.getTime()} className='h-7 border-b last:border-0'>
                        <th className='w-10 px-2.5 text-right font-normal text-muted-foreground'>{i + 1}</th>
                        <td className='px-2.5 font-mono'>{formatRun(d, tz)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className='px-2.5 py-2 text-xs text-muted-foreground'>This expression never matches a date.</p>
              )}
            </Panel>
          </div>
        )
      )}
    </Workspace>
  )
}
