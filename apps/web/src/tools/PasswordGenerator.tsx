import { RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { type Charset, generatePassphrase, generatePassword, passphraseEntropy, passwordEntropy } from '@/lib/password'
import { cn } from '@/lib/utils'

type Mode = 'password' | 'passphrase'

const SETS: [Charset, string][] = [
  ['lower', 'Lowercase (a-z)'],
  ['upper', 'Uppercase (A-Z)'],
  ['digits', 'Digits (0-9)'],
  ['symbols', 'Symbols (!@#…)'],
]

// Number fields keep what was typed (so "1" on the way to "16" isn't snapped to the minimum); generation clamps
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v) || min))

function strength(bits: number): [string, string] {
  if (bits < 40) return ['Weak', 'text-destructive']
  if (bits < 60) return ['Fair', 'text-warning']
  return ['Strong', 'text-success']
}

export default function PasswordGenerator() {
  const [mode, setMode] = useToolState<Mode>('password:mode', 'password')
  const [length, setLength] = useToolState('password:length', 20)
  const [sets, setSets] = useToolState<Charset[]>('password:sets', ['lower', 'upper', 'digits', 'symbols'])
  const [excludeAmbiguous, setExcludeAmbiguous] = useToolState('password:ambiguous', false)
  const [words, setWords] = useToolState('password:words', 6)
  const [separator, setSeparator] = useToolState('password:separator', '-')
  const [capitalize, setCapitalize] = useToolState('password:capitalize', false)
  const [count, setCount] = useToolState('password:count', 1)

  const pw = { length: clamp(length, 4, 128), sets, excludeAmbiguous }
  const pp = { words: clamp(words, 3, 20), separator, capitalize }
  const n = clamp(count, 1, 500)
  const bits = mode === 'password' ? passwordEntropy(pw) : passphraseEntropy(pp)
  const key = JSON.stringify([mode, mode === 'password' ? pw : pp, n])

  // Options that produced the current list are stored with it, so revisiting the tool keeps the same passwords
  const [result, setResult] = useToolState('password:result', { key: '', list: [] as string[] })
  const generate = () =>
    setResult({
      key,
      list: Array.from({ length: n }, () => (mode === 'password' ? generatePassword(pw) : generatePassphrase(pp))),
    })
  // biome-ignore lint/correctness/useExhaustiveDependencies: key captures every option generate() reads
  useEffect(() => {
    if (result.key !== key) generate()
  }, [key])

  const output = result.list.join('\n')
  const [label, color] = strength(bits)
  const empty = mode === 'password' && !sets.length

  return (
    <Workspace
      toolbar={
        <>
          <Segmented<Mode>
            label='Mode'
            value={mode}
            onChange={setMode}
            options={[
              ['password', 'Password'],
              ['passphrase', 'Passphrase'],
            ]}
          />
          <Button size='sm' onClick={generate} disabled={empty}>
            <RefreshCw /> Generate
          </Button>
          <label className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            Count
            <Input
              type='number'
              min={1}
              max={500}
              className='h-7 w-16 text-xs'
              value={count || ''}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <span
            className='ml-auto text-xs text-muted-foreground'
            title='Entropy of one password, assuming the attacker knows these settings'
          >
            {empty ? (
              'Pick at least one character set'
            ) : (
              <>
                <span className='font-mono text-foreground'>{Math.floor(bits)}</span> bits ·{' '}
                <span className={cn('font-medium', color)}>{label}</span>
              </>
            )}
          </span>
        </>
      }
    >
      <Split>
        <Panel title='Options'>
          <div className='grid gap-3 p-2.5 text-[13px]'>
            {mode === 'password' ? (
              <>
                <div className='grid gap-1'>
                  <Label htmlFor='pw-length'>Length</Label>
                  <div className='flex items-center gap-2'>
                    <input
                      type='range'
                      aria-label='Length slider'
                      min={4}
                      max={128}
                      value={pw.length}
                      onChange={(e) => setLength(Number(e.target.value))}
                      className='flex-1 accent-primary'
                    />
                    <Input
                      id='pw-length'
                      type='number'
                      min={4}
                      max={128}
                      className='h-7 w-16 text-xs'
                      value={length || ''}
                      onChange={(e) => setLength(Number(e.target.value))}
                    />
                  </div>
                </div>
                <fieldset className='grid gap-1.5'>
                  <legend className='mb-1 text-xs font-medium text-muted-foreground'>Characters</legend>
                  {SETS.map(([set, title]) => (
                    <Checkbox
                      key={set}
                      title={title}
                      checked={sets.includes(set)}
                      onChange={(e) =>
                        setSets(
                          e.target.checked
                            ? SETS.map(([s]) => s).filter((s) => s === set || sets.includes(s))
                            : sets.filter((s) => s !== set),
                        )
                      }
                    />
                  ))}
                  <Checkbox
                    className='mt-1'
                    title='Exclude ambiguous characters'
                    description='Leaves out I l 1 | O 0 o and quotes, which are easy to misread'
                    checked={excludeAmbiguous}
                    onChange={(e) => setExcludeAmbiguous(e.target.checked)}
                  />
                </fieldset>
              </>
            ) : (
              <>
                <div className='grid gap-1'>
                  <Label htmlFor='pw-words'>Words</Label>
                  <Input
                    id='pw-words'
                    type='number'
                    min={3}
                    max={20}
                    className='w-20'
                    value={words || ''}
                    onChange={(e) => setWords(Number(e.target.value))}
                  />
                </div>
                <div className='grid gap-1'>
                  <Label htmlFor='pw-separator'>Separator</Label>
                  <Input
                    id='pw-separator'
                    className='w-20 font-mono'
                    maxLength={3}
                    value={separator}
                    onChange={(e) => setSeparator(e.target.value)}
                  />
                </div>
                <Checkbox
                  title='Capitalize words'
                  checked={capitalize}
                  onChange={(e) => setCapitalize(e.target.checked)}
                />
                <p className='text-xs text-muted-foreground'>
                  Words come from the{' '}
                  <a className='underline' href='https://www.eff.org/dice' target='_blank' rel='noreferrer'>
                    EFF short wordlist
                  </a>{' '}
                  (1,296 words, CC BY 3.0 US), ~10.3 bits each.
                </p>
              </>
            )}
            <p className='text-xs text-muted-foreground'>
              Generated on your device with crypto.getRandomValues; nothing is sent or stored.
            </p>
          </div>
        </Panel>
        <Panel title={n > 1 ? `${mode}s (${n})` : mode} actions={<CopyButton value={output} disabled={!output} />}>
          <Textarea
            readOnly
            aria-label='Generated'
            className={cn(paneField, 'text-sm break-all')}
            value={empty ? '' : output}
          />
        </Panel>
      </Split>
    </Workspace>
  )
}
