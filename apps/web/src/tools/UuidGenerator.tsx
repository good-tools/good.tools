import { RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Panel, paneField, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'

export type Kind = 'v4' | 'v7' | 'ulid' | 'nanoid'

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const NANOID = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const dashes = (h: string) => h.replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-')

/** UUIDv7 (RFC 9562): 48-bit Unix ms, version 7, variant 10, 74 random bits. */
export function uuidv7(ms = Date.now()): string {
  const r = hex(random(10))
  return dashes(
    `${ms.toString(16).padStart(12, '0')}7${r.slice(0, 3)}${'89ab'[Number.parseInt(r[3]!, 16) & 3]}${r.slice(4, 19)}`,
  )
}

/** ULID: 48-bit Unix ms + 80 random bits in Crockford base32. */
export function ulid(ms = Date.now()): string {
  let time = ''
  for (let i = 0, n = ms; i < 10; i++, n = Math.floor(n / 32)) time = CROCKFORD[n % 32] + time
  return time + Array.from(random(16), (b) => CROCKFORD[b & 31]).join('')
}

/** NanoID: 21 characters from a URL-safe 64-character alphabet (126 random bits). */
export const nanoid = () => Array.from(random(21), (b) => NANOID[b & 63]).join('')

const GENERATORS: Record<Kind, () => string> = { v4: () => crypto.randomUUID(), v7: () => uuidv7(), ulid, nanoid }
export const generate = (kind: Kind, count: number) => Array.from({ length: count }, () => GENERATORS[kind]())

const VERSIONS: Record<number, string> = {
  1: 'Gregorian time + node',
  2: 'DCE Security',
  3: 'Name-based (MD5)',
  4: 'Random',
  5: 'Name-based (SHA-1)',
  6: 'Reordered Gregorian time',
  7: 'Unix time + random',
  8: 'Custom',
}
/** Milliseconds between 1582-10-15 (the epoch of UUID v1/v6 timestamps) and 1970-01-01 */
const GREGORIAN_OFFSET_MS = 12_219_292_800_000

const iso = (ms: number) => {
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? 'out of range' : d.toISOString()
}

/** Explains a UUID or ULID: version, variant and any embedded timestamp. */
export function decode(input: string): [string, string][] {
  const s = input
    .trim()
    .replace(/^urn:uuid:/i, '')
    .replace(/^\{(.*)\}$/, '$1')
  if (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(s)) {
    let ms = 0
    for (const c of s.slice(0, 10).toUpperCase()) ms = ms * 32 + CROCKFORD.indexOf(c)
    return [
      ['Type', 'ULID'],
      ['Timestamp', iso(ms)],
      ['Unix ms', String(ms)],
      ['Randomness', s.slice(10).toUpperCase()],
    ]
  }
  const h = s.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(h) || !/^[0-9a-f-]{32,36}$/i.test(s))
    throw new Error('Not a UUID (8-4-4-4-12 hex digits) or a ULID (26 Crockford base32 characters)')
  if (/^0+$/.test(h)) return [['Type', 'Nil UUID']]
  if (/^f+$/.test(h)) return [['Type', 'Max UUID']]
  const version = Number.parseInt(h[12]!, 16)
  const v = Number.parseInt(h[16]!, 16)
  const variant =
    v < 8 ? 'NCS (reserved)' : v < 12 ? 'RFC 9562 / RFC 4122' : v < 14 ? 'Microsoft (reserved)' : 'Reserved'
  const rows: [string, string][] = [
    ['Type', 'UUID'],
    ['Canonical', dashes(h)],
    ['Variant', variant],
  ]
  if (variant.startsWith('RFC')) rows.push(['Version', `${version} · ${VERSIONS[version] ?? 'unknown'}`])
  else return rows
  if (version === 1 || version === 6) {
    const t = BigInt(
      `0x${version === 1 ? h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8) : h.slice(0, 12) + h.slice(13, 16)}`,
    )
    const ms = Number(t / 10_000n) - GREGORIAN_OFFSET_MS
    rows.push(['Timestamp', iso(ms)], ['Clock sequence', String(Number.parseInt(h.slice(16, 20), 16) & 0x3fff)])
    rows.push(['Node', h.slice(20).replace(/(..)(?!$)/g, '$1:')])
  } else if (version === 7) {
    const ms = Number.parseInt(h.slice(0, 12), 16)
    rows.push(['Timestamp', iso(ms)], ['Unix ms', String(ms)])
  }
  return rows
}

type Mode = 'generate' | 'decode'

export default function UuidGenerator() {
  const [mode, setMode] = useToolState<Mode>('uuid:mode', 'generate')
  const [kind, setKind] = useToolState<Kind>('uuid:kind', 'v4')
  // Kept as typed so the field can be emptied while editing; clamped when generating
  const [count, setCount] = useToolState('uuid:count', '5')
  const [ids, setIds] = useToolState('uuid:ids', () => generate('v4', 5))
  const [input, setInput] = useToolState('uuid:input', '')

  const regenerate = (k = kind, n = count) =>
    setIds(generate(k, Math.min(1000, Math.max(1, Math.floor(Number(n)) || 1))))
  const output = ids.join('\n')

  const decoded = useMemo((): { rows: [string, string][]; error?: string } => {
    if (!input.trim()) return { rows: [] }
    try {
      return { rows: decode(input) }
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : String(e) }
    }
  }, [input])

  return (
    <Workspace
      toolbar={
        <>
          <Segmented<Mode>
            label='Mode'
            value={mode}
            onChange={setMode}
            options={[
              ['generate', 'Generate'],
              ['decode', 'Decode'],
            ]}
          />
          {mode === 'generate' ? (
            <>
              <Segmented<Kind>
                label='Type'
                value={kind}
                onChange={(k) => {
                  setKind(k)
                  regenerate(k)
                }}
                options={[
                  ['v4', 'UUID v4'],
                  ['v7', 'UUID v7'],
                  ['ulid', 'ULID'],
                  ['nanoid', 'NanoID'],
                ]}
              />
              <Label htmlFor='uuid-count'>Count</Label>
              <Input
                id='uuid-count'
                type='number'
                min={1}
                max={1000}
                className='h-7 w-20'
                value={count}
                onChange={(e) => {
                  setCount(e.target.value)
                  if (e.target.value) regenerate(kind, e.target.value)
                }}
              />
              <Button size='sm' onClick={() => regenerate()}>
                <RefreshCw /> Generate
              </Button>
            </>
          ) : (
            <Input
              autoFocus
              aria-label='UUID or ULID to decode'
              className='h-7 max-w-md font-mono'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='e.g. 017f22e2-79b0-7cc3-98c4-dc0c0c07398f or 01ARZ3NDEKTSV4RRFFQ69G5FAV'
            />
          )}
        </>
      }
    >
      {mode === 'generate' ? (
        <Panel
          title={`${kind === 'ulid' ? 'ULID' : kind === 'nanoid' ? 'NanoID' : `UUID ${kind}`} · ${ids.length}`}
          className='flex-1'
          actions={<CopyButton value={output} label={ids.length > 1 ? 'Copy all' : 'Copy'} />}
        >
          <Textarea readOnly aria-label='Generated IDs' className={paneField} value={output} />
        </Panel>
      ) : (
        <>
          <Alert>{decoded.error}</Alert>
          {decoded.rows.length > 0 && (
            <Panel className='max-w-3xl'>
              <table className='w-full text-xs'>
                <tbody>
                  {decoded.rows.map(([label, value]) => (
                    <tr key={label} className='h-8 border-b last:border-0'>
                      <th className='w-36 px-2.5 text-left font-medium text-muted-foreground'>{label}</th>
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
        </>
      )}
    </Workspace>
  )
}
