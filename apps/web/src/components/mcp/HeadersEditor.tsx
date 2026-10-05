import { Eye, EyeOff, KeyRound, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { type HeaderRow, newHeader } from '@/stores/mcp.store'

const SENSITIVE = /authorization|cookie|token|key|secret|password/i

/** Editable list of request headers (auth tokens, API keys, …). Values of sensitive headers are masked. */
export function HeadersEditor({ headers, onChange }: { headers: HeaderRow[]; onChange: (h: HeaderRow[]) => void }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const update = (id: number, patch: Partial<HeaderRow>) =>
    onChange(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)))
  const add = (key = '', value = '') => {
    // Reuse an empty row rather than stacking blanks
    const blank = headers.find((h) => !h.key && !h.value)
    onChange(blank ? headers.map((h) => (h === blank ? { ...h, key, value } : h)) : [...headers, newHeader(key, value)])
  }

  return (
    <div className='flex flex-col gap-1.5'>
      {headers.map((h) => {
        const masked = SENSITIVE.test(h.key) && !revealed.has(h.id)
        return (
          <div key={h.id} className={cn('flex items-center gap-1.5', !h.enabled && 'opacity-50')}>
            <Checkbox
              aria-label={`Send ${h.key || 'header'}`}
              checked={h.enabled}
              onChange={(e) => update(h.id, { enabled: e.target.checked })}
            />
            <Input
              aria-label='Header name'
              placeholder='Header'
              value={h.key}
              onChange={(e) => update(h.id, { key: e.target.value })}
              className='h-7 w-44 font-mono text-xs'
              spellCheck={false}
            />
            <div className='relative flex-1'>
              <Input
                aria-label={`${h.key || 'Header'} value`}
                placeholder='Value'
                type={masked ? 'password' : 'text'}
                autoComplete='off'
                value={h.value}
                onChange={(e) => update(h.id, { value: e.target.value })}
                className='h-7 pr-8 font-mono text-xs'
                spellCheck={false}
              />
              {SENSITIVE.test(h.key) && (
                <button
                  type='button'
                  aria-label={masked ? 'Show value' : 'Hide value'}
                  onClick={() =>
                    setRevealed((r) => {
                      const next = new Set(r)
                      if (next.has(h.id)) next.delete(h.id)
                      else next.add(h.id)
                      return next
                    })
                  }
                  className='absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground'
                >
                  {masked ? <Eye className='size-3.5' /> : <EyeOff className='size-3.5' />}
                </button>
              )}
            </div>
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label={`Remove ${h.key || 'header'}`}
              onClick={() => onChange(headers.filter((x) => x.id !== h.id))}
            >
              <X />
            </Button>
          </div>
        )
      })}
      <div className='flex flex-wrap items-center gap-1'>
        <Button size='sm' variant='ghost' onClick={() => add('Authorization', 'Bearer ')}>
          <KeyRound /> Bearer token
        </Button>
        <Button size='sm' variant='ghost' onClick={() => add('X-API-Key', '')}>
          <KeyRound /> API key
        </Button>
        <Button size='sm' variant='ghost' onClick={() => add()}>
          <Plus /> Custom header
        </Button>
        <span className='ml-auto text-[11px] text-muted-foreground'>
          Sent with every request. Kept in memory for this tab only; never saved.
        </span>
      </div>
    </div>
  )
}
