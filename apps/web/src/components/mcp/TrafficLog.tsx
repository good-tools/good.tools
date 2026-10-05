import { ArrowDownLeft, ArrowUpRight, ChevronRight, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import type { TrafficEntry } from '@/lib/mcp'
import { cn } from '@/lib/utils'

function describe(entry: TrafficEntry, requestMethods: Map<string | number, string>) {
  const m = entry.message as { id?: string | number; method?: string; result?: unknown; error?: { message?: string } }
  if (m.method) return { label: m.method, kind: m.id === undefined ? 'notification' : 'request' }
  const method = m.id !== undefined ? requestMethods.get(m.id) : undefined
  return { label: method ?? 'response', kind: m.error ? 'error' : 'response', error: m.error?.message }
}

export function TrafficLog({ traffic, onClear }: { traffic: TrafficEntry[]; onClear: () => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  // request id → method / send time, to label responses and show latency
  const { methods, sentAt } = useMemo(() => {
    const methods = new Map<string | number, string>()
    const sentAt = new Map<string | number, number>()
    for (const t of traffic) {
      const m = t.message as { id?: string | number; method?: string }
      if (t.direction === 'out' && m.id !== undefined && m.method) {
        methods.set(m.id, m.method)
        sentAt.set(m.id, t.time)
      }
    }
    return { methods, sentAt }
  }, [traffic])

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow new messages as they arrive
  useEffect(() => bottom.current?.scrollIntoView({ block: 'nearest' }), [traffic.length])

  const start = traffic[0]?.time ?? 0

  return (
    <div className='flex h-full flex-col'>
      <div className='flex min-h-8 shrink-0 items-center gap-2 border-b bg-muted/50 py-0.5 pr-1 pl-2.5'>
        <h2 className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
          Traffic <span className='font-normal normal-case'>· {traffic.length} messages</span>
        </h2>
        <Button size='icon-sm' variant='ghost' className='ml-auto' aria-label='Clear traffic' onClick={onClear}>
          <Trash2 />
        </Button>
      </div>
      <div className='min-h-0 flex-1 overflow-auto font-mono text-[11px]'>
        {traffic.length === 0 && <p className='p-3 font-sans text-xs text-muted-foreground'>No messages yet.</p>}
        {traffic.map((t) => {
          const d = describe(t, methods)
          const id = (t.message as { id?: string | number }).id
          const latency = t.direction === 'in' && id !== undefined && sentAt.has(id) ? t.time - sentAt.get(id)! : null
          const json = JSON.stringify(t.message, null, 2)
          const expanded = open === t.id
          return (
            <div key={t.id} className='border-b last:border-0'>
              <button
                type='button'
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : t.id)}
                className='flex h-6 w-full items-center gap-2 px-2.5 text-left hover:bg-accent/60'
              >
                <ChevronRight
                  className={cn('size-3 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')}
                />
                {t.direction === 'out' ? (
                  <ArrowUpRight className='size-3 shrink-0 text-sky-600 dark:text-sky-400' aria-label='sent' />
                ) : (
                  <ArrowDownLeft
                    className='size-3 shrink-0 text-violet-600 dark:text-violet-400'
                    aria-label='received'
                  />
                )}
                <span className='w-14 shrink-0 text-right text-muted-foreground tabular-nums'>
                  +{((t.time - start) / 1000).toFixed(2)}s
                </span>
                <span
                  className={cn(
                    'truncate',
                    d.kind === 'error' && 'text-destructive',
                    d.kind === 'notification' && 'text-muted-foreground',
                  )}
                >
                  {d.label}
                  {id !== undefined && <span className='text-muted-foreground'> #{id}</span>}
                  {d.error && <span> · {d.error}</span>}
                </span>
                <span className='ml-auto shrink-0 text-muted-foreground tabular-nums'>
                  {latency !== null && `${Math.round(latency)} ms · `}
                  {json.length > 1024 ? `${(json.length / 1024).toFixed(1)} KB` : `${json.length} B`}
                </span>
              </button>
              {expanded && (
                <div className='relative border-t bg-muted/30'>
                  <CopyButton size='icon-sm' label='Copy message' value={json} className='absolute top-1 right-1' />
                  <pre className='max-h-72 overflow-auto p-2.5 pr-10 break-words whitespace-pre-wrap'>{json}</pre>
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottom} />
      </div>
    </div>
  )
}
