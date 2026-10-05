import { Clock } from 'lucide-react'
import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { fieldClass, Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { cn } from '@/lib/utils'

export type Unit = 's' | 'ms' | 'us' | 'ns'
const NS_PER: Record<Unit, bigint> = { s: 1_000_000_000n, ms: 1_000_000n, us: 1_000n, ns: 1n }
const UNIT_NAMES: Record<Unit, string> = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' }

/** Guess the unit of a bare number from its magnitude (seconds cover years 1973–5138). */
export function detectUnit(abs: number): Unit {
  return abs < 1e11 ? 's' : abs < 1e14 ? 'ms' : abs < 1e17 ? 'us' : 'ns'
}

/**
 * Parses a Unix timestamp (any unit, optional fraction) or a date string into nanoseconds since the epoch.
 * Numbers are parsed exactly with BigInt, so nanosecond inputs keep their precision.
 */
export function parseTimestamp(input: string, unit: Unit | 'auto'): { ns: bigint; unit?: Unit } {
  const s = input.trim()
  const num = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(s)
  let ns: bigint
  let used: Unit | undefined
  if (num) {
    const [, sign, int = '0', frac = ''] = num
    used = unit === 'auto' ? detectUnit(Math.abs(Number(`${int}.${frac}`))) : unit
    const per = NS_PER[used]
    const digits = per.toString().length - 1
    ns = BigInt(int) * per + BigInt(frac.padEnd(digits, '0').slice(0, digits) || '0')
    if (sign === '-') ns = -ns
  } else {
    const ms = Date.parse(s)
    if (Number.isNaN(ms)) throw new Error(`Not a timestamp or a date the browser can parse: "${s}"`)
    ns = BigInt(ms) * 1_000_000n
  }
  if (ns / 1_000_000n > 8_640_000_000_000_000n || ns / 1_000_000n < -8_640_000_000_000_000n)
    throw new Error('Out of range: dates must be within ±100,000,000 days of 1970')
  return { ns, unit: used }
}

/** Floor division (BigInt `/` truncates toward zero, which is wrong for dates before 1970). */
const floorDiv = (a: bigint, b: bigint) => (a < 0n && a % b !== 0n ? a / b - 1n : a / b)
const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** UTC offset of `timeZone` at `date`, in minutes. */
export function offsetMinutes(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value
  const m = /([+-])(\d\d):(\d\d)/.exec(name ?? '')
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}

const formatOffset = (min: number, colon: boolean) =>
  `${min < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(min) / 60))}${colon ? ':' : ''}${pad(Math.abs(min) % 60)}`

/** ISO 8601 and RFC 2822 strings of `date` in `timeZone`. */
export function zoned(date: Date, timeZone: string) {
  const off = offsetMinutes(date, timeZone)
  const wall = new Date(date.getTime() + off * 60_000)
  return {
    iso: wall.toISOString().slice(0, -1) + formatOffset(off, true),
    rfc2822: wall.toUTCString().replace('GMT', formatOffset(off, false)),
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365.25 * 864e5],
  ['month', 30.44 * 864e5],
  ['week', 7 * 864e5],
  ['day', 864e5],
  ['hour', 36e5],
  ['minute', 6e4],
  ['second', 1e3],
]
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "3 hours ago", "in 2 days", "now" */
export function relative(ms: number, now = Date.now()): string {
  const diff = ms - now
  const [unit, size] = UNITS.find(([, size]) => Math.abs(diff) >= size) ?? ['second', 1e3]
  return rtf.format(Math.round(diff / size), unit)
}

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
const TIME_ZONES = [...new Set(['UTC', LOCAL_TZ, ...Intl.supportedValuesOf('timeZone')])]

export default function TimestampConverter() {
  const [input, setInput] = useToolState('timestamp:input', () => String(Math.floor(Date.now() / 1000)))
  const [unit, setUnit] = useToolState<Unit | 'auto'>('timestamp:unit', 'auto')
  const [tz, setTz] = useToolState('timestamp:tz', LOCAL_TZ)

  const result = useMemo((): { rows: [string, string][]; detected?: Unit; error?: string } => {
    if (!input.trim()) return { rows: [] }
    try {
      const { ns, unit: detected } = parseTimestamp(input, unit)
      const ms = Number(floorDiv(ns, 1_000_000n))
      const date = new Date(ms)
      const z = zoned(date, tz)
      const human = (timeZone: string) =>
        date.toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'long' })
      return {
        detected,
        rows: [
          ['Unix seconds', floorDiv(ns, NS_PER.s).toString()],
          ['Milliseconds', floorDiv(ns, NS_PER.ms).toString()],
          ['Microseconds', floorDiv(ns, NS_PER.us).toString()],
          ['Nanoseconds', ns.toString()],
          ['ISO 8601 (UTC)', date.toISOString()],
          [`ISO 8601 (${tz})`, z.iso],
          [`RFC 2822 (${tz})`, z.rfc2822],
          ['UTC', human('UTC')],
          ...(tz === 'UTC' ? [] : ([[tz, human(tz)]] as [string, string][])),
          ...(tz === LOCAL_TZ ? [] : ([[`Local (${LOCAL_TZ})`, human(LOCAL_TZ)]] as [string, string][])),
          ['Relative', relative(ms)],
        ],
      }
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : String(e) }
    }
  }, [input, unit, tz])

  return (
    <Workspace
      toolbar={
        <>
          <Input
            autoFocus
            aria-label='Timestamp or date'
            className='h-7 max-w-md font-mono'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='1700000000, 1700000000000 or 2023-11-14T22:13:20Z'
          />
          <Segmented<Unit | 'auto'>
            label='Unit'
            value={unit}
            onChange={setUnit}
            options={[
              [
                'auto',
                result.detected && unit === 'auto'
                  ? `Auto (${result.detected === 'us' ? 'µs' : result.detected})`
                  : 'Auto',
              ],
              ['s', 's'],
              ['ms', 'ms'],
              ['us', 'µs'],
              ['ns', 'ns'],
            ]}
          />
          <Button size='sm' variant='ghost' onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>
            <Clock /> Now
          </Button>
          <div className='ml-auto flex items-center gap-2'>
            <Label htmlFor='timestamp-tz'>Time zone</Label>
            <select
              id='timestamp-tz'
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
      <Alert>{result.error}</Alert>
      {result.detected && (
        <p className='text-xs text-muted-foreground'>
          Read as {UNIT_NAMES[result.detected]}
          {unit === 'auto' && ' (detected from the number of digits)'}.
        </p>
      )}
      {result.rows.length > 0 && (
        <Panel className='max-w-3xl'>
          <table className='w-full text-xs'>
            <tbody>
              {result.rows.map(([label, value]) => (
                <tr key={label} className='h-8 border-b last:border-0'>
                  <th className='w-48 px-2.5 text-left font-medium text-muted-foreground'>{label}</th>
                  <td className='px-2.5 py-1 font-mono break-all'>{value}</td>
                  <td className='w-8 pr-1'>
                    <CopyButton value={value} size='icon-sm' label={`Copy ${label}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </Workspace>
  )
}
