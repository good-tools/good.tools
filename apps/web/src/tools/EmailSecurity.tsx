import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Info, Search, Shuffle, X, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { EXAMPLE_DOMAINS, getJSON, useSubmittedQuery } from '@/hooks/useApiQuery'
import { useToolState } from '@/hooks/useToolState'
import { type Check, checkEmailSecurity, type SpfNode, type Status } from '@/lib/email-security'
import { cn } from '@/lib/utils'
import type { DNSResponse } from '@/types/api.types'

const STATUS: Record<Status, { variant: BadgeVariant; icon: typeof Info; className: string; label: string }> = {
  pass: { variant: 'success', icon: CheckCircle2, className: 'text-success', label: 'Pass' },
  warn: { variant: 'warning', icon: AlertTriangle, className: 'text-warning', label: 'Warn' },
  fail: { variant: 'destructive', icon: XCircle, className: 'text-destructive', label: 'Fail' },
  info: { variant: 'outline', icon: Info, className: 'text-muted-foreground', label: 'Info' },
}

const lookup = (name: string) => getJSON<DNSResponse>('/dns', { domain: name }, `DNS lookup of ${name} failed`)

function StatusBadge({ status }: { status: Status }) {
  const { variant, icon: Icon, label } = STATUS[status]
  return (
    <Badge variant={variant}>
      <Icon /> {label}
    </Badge>
  )
}

function SpfTree({ node, depth = 0 }: { node: SpfNode; depth?: number }) {
  return (
    <>
      <li style={{ paddingLeft: `${depth * 14}px` }} className='break-all'>
        {node.via && <span className='text-muted-foreground'>{node.via} → </span>}
        {node.record ?? <span className='text-destructive'>{node.error}</span>}
        {node.lookups > 0 && <span className='text-muted-foreground'> · {node.lookups} lookups</span>}
      </li>
      {node.children.map((c) => (
        <SpfTree key={c.via} node={c} depth={depth + 1} />
      ))}
    </>
  )
}

function CheckPanel({ check }: { check: Check }) {
  return (
    <Panel
      id={`check-${check.id}`}
      title={check.title}
      className='shrink-0'
      actions={
        <>
          <StatusBadge status={check.status} />
          <CopyButton value={check.records.join('\n')} disabled={!check.records.length} label='Copy record' />
        </>
      }
    >
      <div className='space-y-2 p-2.5 text-xs'>
        <div className='font-mono text-muted-foreground'>{check.name}</div>
        {check.spf?.children.length ? (
          <ul className='space-y-0.5 font-mono'>
            <SpfTree node={check.spf} />
          </ul>
        ) : (
          check.records.map((r) => (
            <div key={r} className='rounded bg-muted/50 px-2 py-1 font-mono break-all'>
              {r}
            </div>
          ))
        )}
        <ul className='space-y-1'>
          {check.findings.map((f, i) => {
            const { icon: Icon, className } = STATUS[f.status]
            return (
              <li key={i} className='flex items-start gap-1.5 text-[13px]'>
                <Icon className={cn('mt-0.5 size-3.5 shrink-0', className)} aria-label={STATUS[f.status].label} />
                <span className='min-w-0 break-words'>{f.message}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </Panel>
  )
}

export default function EmailSecurity() {
  const [submitted, submit] = useSubmittedQuery()
  const [address, setAddress] = useState(submitted)
  const [selectors, setSelectors] = useToolState('email-security:selectors', '')
  const [usedSelectors, setUsedSelectors] = useToolState('email-security:used-selectors', '')
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['email-security', submitted, usedSelectors],
    queryFn: () => checkEmailSecurity(submitted, usedSelectors.split(/[\s,]+/).filter(Boolean), lookup),
    enabled: !!submitted,
    retry: false,
  })

  const load = () => {
    const domain = address.trim()
    setUsedSelectors(selectors)
    if (domain && domain === submitted && selectors === usedSelectors) void refetch()
    else submit(domain)
  }
  const clear = () => {
    setAddress('')
    submit('')
  }
  const loadRandom = () => setAddress(EXAMPLE_DOMAINS[Math.floor(Math.random() * EXAMPLE_DOMAINS.length)] ?? '')

  return (
    <Workspace
      toolbar={
        <>
          <Input
            autoFocus
            aria-label='Domain'
            className='max-w-xs flex-1'
            placeholder='example.com'
            value={address}
            onEnter={load}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete='off'
          />
          <Input
            aria-label='DKIM selectors'
            title='Extra DKIM selectors to try, besides the common ones'
            className='max-w-56 flex-1'
            placeholder='DKIM selectors, e.g. s2048, mx'
            value={selectors}
            onEnter={load}
            onChange={(e) => setSelectors(e.target.value)}
            autoComplete='off'
          />
          <Button size='sm' onClick={load} disabled={isFetching || !address.trim()}>
            <Search /> Check
          </Button>
          <Button variant='ghost' size='sm' disabled={isFetching} onClick={loadRandom}>
            <Shuffle /> Random example
          </Button>
          <Button variant='ghost' size='sm' disabled={isFetching || !address} onClick={clear}>
            <X /> Clear
          </Button>
          {isFetching && <Spinner label='Checking…' />}
        </>
      }
    >
      <Alert>{error?.message}</Alert>
      {!data ? (
        !isFetching &&
        !error && (
          <p className='text-xs text-muted-foreground'>
            Enter a domain to check its SPF, DKIM, DMARC, MX, MTA-STS, TLS-RPT and BIMI records.
          </p>
        )
      ) : (
        <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-auto'>
          <Panel title={`Summary · ${submitted}`} className='shrink-0'>
            <table className='w-full text-xs'>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className='h-7 border-b last:border-0 hover:bg-muted/40'>
                    <td className='w-36 px-2.5 font-medium whitespace-nowrap'>
                      <a href={`#check-${c.id}`} className='hover:underline'>
                        {c.title}
                      </a>
                    </td>
                    <td className='w-16'>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className='px-2.5 py-1 text-muted-foreground'>
                      {(c.findings.find((f) => f.status === c.status) ?? c.findings[0])?.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <div className='grid items-start gap-2 lg:grid-cols-2'>
            {data.map((c) => (
              <CheckPanel key={c.id} check={c} />
            ))}
          </div>
        </div>
      )}
    </Workspace>
  )
}
