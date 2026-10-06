import { ArrowUpDown, Pipette } from 'lucide-react'
import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  contrast,
  inGamut,
  parseColor,
  type Rgba,
  tintsAndShades,
  toCmyk,
  toHex,
  toHsl,
  toHwb,
  toLab,
  toOklab,
  toOklch,
  toRgb,
} from '@/lib/color'

declare global {
  // EyeDropper API (Chromium only), not yet in lib.dom
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> }
  }
}

const FORMATS: [string, (c: Rgba) => string][] = [
  ['HEX', toHex],
  ['RGB', toRgb],
  ['HSL', toHsl],
  ['HWB', toHwb],
  ['OKLCH', toOklch],
  ['OKLAB', toOklab],
  ['LAB', toLab],
  ['CMYK', toCmyk],
]

const checker = 'bg-[repeating-conic-gradient(#8884_0%_25%,transparent_0%_50%)] bg-size-[12px_12px]'

function tryParse(s: string): { color?: Rgba; error?: string } {
  try {
    return { color: parseColor(s) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Text field + native picker (+ EyeDropper when the browser has it) for one color. */
function ColorField({
  id,
  label,
  value,
  color,
  onChange,
}: {
  id: string
  label: string
  value: string
  color?: Rgba
  onChange: (v: string) => void
}) {
  const pick = async () => {
    try {
      onChange((await new window.EyeDropper!().open()).sRGBHex)
    } catch {
      // Cancelled with Esc
    }
  }
  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className='h-7 w-56 font-mono'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='#3b82f6, oklch(…), tomato'
        spellCheck={false}
      />
      <input
        type='color'
        aria-label={`${label} picker`}
        className='h-7 w-9 cursor-pointer rounded-md border bg-background p-0.5'
        value={color ? toHex({ ...color, alpha: 1 }) : '#000000'}
        // The native input is opaque-only: keep the current alpha
        onChange={(e) => onChange(toHex({ ...parseColor(e.target.value), alpha: color?.alpha ?? 1 }))}
      />
      {typeof window !== 'undefined' && window.EyeDropper && (
        <Button size='icon-sm' variant='ghost' onClick={pick} aria-label={`Pick ${label.toLowerCase()} from screen`}>
          <Pipette />
        </Button>
      )}
    </>
  )
}

export default function ColorPicker() {
  const [input, setInput] = useToolState('color:input', '#3b82f6')
  const [bgInput, setBgInput] = useToolState('color:bg', '#ffffff')

  const fg = useMemo(() => tryParse(input), [input])
  const bg = useMemo(() => tryParse(bgInput), [bgInput])
  const ratio = fg.color && bg.color ? contrast(fg.color, bg.color) : undefined

  return (
    <Workspace
      className='overflow-auto'
      toolbar={<ColorField id='color-input' label='Color' value={input} color={fg.color} onChange={setInput} />}
    >
      <Alert>{fg.error}</Alert>
      {fg.color && (
        <div className='grid gap-2 lg:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <Panel title='Swatch'>
              <div className={checker}>
                <div className='h-32' style={{ background: toRgb(fg.color) }} />
              </div>
              <div className='flex'>
                {tintsAndShades(fg.color).map((c, i) => {
                  const hex = toHex(c)
                  return (
                    <button
                      key={i}
                      type='button'
                      title={hex}
                      aria-label={`Use ${hex}`}
                      className='h-8 flex-1 outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-ring'
                      style={{ background: hex }}
                      onClick={() => setInput(hex)}
                    />
                  )
                })}
              </div>
            </Panel>
            <Alert variant='info'>
              {!inGamut(fg.color) &&
                'Outside the sRGB gamut: HEX, RGB, HSL, HWB and CMYK show the nearest clipped color.'}
            </Alert>
            <Panel title='Formats'>
              <table className='w-full text-xs'>
                <tbody>
                  {FORMATS.map(([label, f]) => {
                    const value = f(fg.color!)
                    return (
                      <tr key={label} className='h-8 border-b last:border-0'>
                        <th className='w-20 px-2.5 text-left font-medium text-muted-foreground'>{label}</th>
                        <td className='px-2.5 py-1 font-mono break-all'>{value}</td>
                        <td className='w-8 pr-1'>
                          <CopyButton value={value} size='icon-sm' label={`Copy ${label}`} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>
          </div>
          <Panel
            title='Contrast'
            className='self-start'
            actions={
              <Button
                size='sm'
                variant='ghost'
                onClick={() => {
                  setInput(bgInput)
                  setBgInput(input)
                }}
              >
                <ArrowUpDown /> Swap
              </Button>
            }
          >
            <div className='flex flex-col gap-2 p-2.5'>
              <div className='flex flex-wrap items-center gap-1.5'>
                <ColorField id='color-bg' label='Background' value={bgInput} color={bg.color} onChange={setBgInput} />
              </div>
              <Alert>{bg.error}</Alert>
              {bg.color && ratio !== undefined && (
                <>
                  <div className={`${checker} overflow-hidden rounded-md border`}>
                    <div className='p-4' style={{ background: toRgb(bg.color), color: toRgb(fg.color) }}>
                      <p className='text-[13px]'>Normal text: the quick brown fox jumps over the lazy dog.</p>
                      <p className='mt-1 text-2xl'>Large text 24px</p>
                    </div>
                  </div>
                  <div className='flex items-baseline gap-2'>
                    <span className='font-mono text-2xl font-semibold' data-testid='ratio'>
                      {(Math.floor(ratio * 100) / 100).toFixed(2)}:1
                    </span>
                    <span className='text-xs text-muted-foreground'>WCAG 2 contrast ratio</span>
                  </div>
                  <table className='w-full text-xs'>
                    <thead>
                      <tr className='h-7 border-b text-muted-foreground'>
                        <th className='text-left font-medium'>Level</th>
                        <th className='text-left font-medium'>Normal text</th>
                        <th className='text-left font-medium'>Large text (24px, or 18.66px bold)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['AA', 4.5, 3],
                          ['AAA', 7, 4.5],
                        ] as const
                      ).map(([level, normal, large]) => (
                        <tr key={level} className='h-8 border-b last:border-0'>
                          <th className='text-left font-medium'>{level}</th>
                          {[normal, large].map((min) => (
                            <td key={min}>
                              <Badge variant={ratio >= min ? 'success' : 'destructive'}>
                                {ratio >= min ? 'Pass' : 'Fail'} · {min}:1
                              </Badge>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </Panel>
        </div>
      )}
    </Workspace>
  )
}
