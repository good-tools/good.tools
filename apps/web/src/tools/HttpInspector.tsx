import { AlertTriangle, CheckCircle2, Search, Shuffle, X, XCircle } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { useHTTPInspectQuery, useSubmittedQuery } from '@/hooks/useApiQuery'
import { type CheckStatus, gradeHeaders } from '@/lib/security-headers'
import type { InspectCert, InspectHop, InspectTLS } from '@/types/api.types'

const EXAMPLES = [
  'good.tools',
  'github.com',
  'http://example.com',
  'cloudflare.com',
  'mozilla.org',
  'http://google.com',
]

const statusIcon: Record<CheckStatus, ReactNode> = {
  pass: <CheckCircle2 aria-label='Pass' className='size-3.5 text-success' />,
  warn: <AlertTriangle aria-label='Warning' className='size-3.5 text-warning' />,
  fail: <XCircle aria-label='Missing or weak' className='size-3.5 text-destructive' />,
}

const httpVariant = (s: number): BadgeVariant => (s < 300 ? 'success' : s < 400 ? 'outline' : 'destructive')
const gradeVariant = (g: string): BadgeVariant =>
  g.startsWith('A') ? 'success' : g === 'B' || g === 'C' ? 'warning' : 'destructive'
const ms = (n: number) => `${Math.round(n)} ms`
const day = (iso: string) => iso.slice(0, 10)

function KeyValues({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className='w-full text-xs'>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className='h-7 border-b last:border-0'>
            <th className='w-28 px-2.5 py-1 text-left align-top font-medium text-muted-foreground'>{label}</th>
            <td className='px-2.5 py-1 font-mono break-all'>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Hops({ hops }: { hops: InspectHop[] }) {
  return (
    <table className='w-full text-xs'>
      <tbody>
        {hops.map((h, i) => (
          <tr key={i} className='border-b last:border-0 hover:bg-muted/40'>
            <td className='w-12 px-2.5 py-1.5 align-top'>
              <Badge variant={httpVariant(h.status)}>{h.status}</Badge>
            </td>
            <td className='px-2.5 py-1.5 font-mono break-all'>
              {h.url}
              {h.location && <div className='text-muted-foreground'>→ {h.location}</div>}
            </td>
            <td className='w-36 px-2.5 py-1.5 text-right align-top whitespace-nowrap'>
              <div>
                {ms(h.timing.total)} <span className='text-muted-foreground'>{h.proto}</span>
              </div>
              <div className='text-[11px] text-muted-foreground'>
                dns {Math.round(h.timing.dns)} · tcp {Math.round(h.timing.connect)}
                {h.tls && ` · tls ${Math.round(h.timing.tls)}`} · ttfb {Math.round(h.timing.ttfb)}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Cert({ cert, index }: { cert: InspectCert; index: number }) {
  const days = cert.days_left
  return (
    <div className='border-t'>
      <div className='flex h-7 items-center gap-2 bg-muted/30 px-2.5 text-[11px] font-medium text-muted-foreground'>
        {index === 0 ? 'Leaf' : `Chain #${index}`}
        <Badge variant={days < 0 ? 'destructive' : days < 30 ? 'warning' : 'outline'}>
          {days < 0 ? `expired ${-days} days ago` : `${days} days left`}
        </Badge>
      </div>
      <KeyValues
        rows={[
          ['Subject', cert.subject],
          ['Issuer', cert.issuer],
          ['Valid', `${day(cert.not_before)} → ${day(cert.not_after)}`],
          ['Key', `${cert.key} · ${cert.signature}`],
          ...(cert.sans?.length ? [['SANs', cert.sans.join(', ')] as [string, ReactNode]] : []),
        ]}
      />
    </div>
  )
}

function TLSDetails({ tls, hop }: { tls: InspectTLS; hop: InspectHop }) {
  return (
    <>
      <KeyValues
        rows={[
          ['Host', hop.url.replace(/^https:\/\/([^/]+).*$/, '$1')],
          ['Address', hop.remote_addr ?? '—'],
          ['Version', tls.version],
          ['Cipher', tls.cipher],
          ['ALPN', tls.alpn || '—'],
          ['OCSP stapling', tls.ocsp_stapled ? 'yes' : 'no'],
          [
            'Trust',
            <span key='trust' className='flex flex-wrap items-center gap-1.5'>
              <Badge variant={tls.trusted ? 'success' : 'destructive'}>{tls.trusted ? 'trusted' : 'not trusted'}</Badge>
              {tls.verify_error}
            </span>,
          ],
        ]}
      />
      {tls.chain.map((c, i) => (
        <Cert key={i} cert={c} index={i} />
      ))}
    </>
  )
}

export default function HttpInspector() {
  const [submitted, submit] = useSubmittedQuery()
  const [address, setAddress] = useState(submitted)
  const { data, isFetching, error, refetch } = useHTTPInspectQuery(submitted)

  const inspect = () => {
    const url = address.trim()
    if (url && url === submitted) void refetch()
    else submit(url)
  }
  const clear = () => {
    setAddress('')
    submit('')
  }

  const final = data?.hops.at(-1)
  const tlsHop = data?.hops.findLast((h) => h.tls)
  const grade = final && gradeHeaders(final.headers, final.url.startsWith('https:'))
  const headers = final ? Object.entries(final.headers).flatMap(([k, vs]) => vs.map((v) => [k, v] as const)) : []

  return (
    <Workspace
      toolbar={
        <>
          <Input
            autoFocus
            aria-label='URL or host'
            className='max-w-md min-w-44 flex-1 font-mono'
            placeholder='https://example.com'
            value={address}
            onEnter={inspect}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete='off'
          />
          <Button size='sm' onClick={inspect} disabled={isFetching || !address.trim()}>
            <Search /> Inspect
          </Button>
          <Button
            variant='ghost'
            size='sm'
            disabled={isFetching}
            onClick={() => setAddress(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)] ?? '')}
          >
            <Shuffle /> Random example
          </Button>
          <Button variant='ghost' size='sm' disabled={isFetching || !address} onClick={clear}>
            <X /> Clear
          </Button>
          {isFetching && <Spinner label='Inspecting…' />}
        </>
      }
    >
      <Alert>{error?.message}</Alert>
      <Alert variant='warning'>{data?.error}</Alert>
      {!data || !final || !grade ? (
        !isFetching &&
        !error && (
          <p className='text-xs text-muted-foreground'>
            Enter a URL or host to follow its redirects and check its security headers and TLS certificate. Only public
            hosts can be inspected.
          </p>
        )
      ) : (
        <Split>
          <div className='flex min-h-0 flex-col gap-2'>
            <Panel
              title={`Redirects · ${data.hops.length} ${data.hops.length === 1 ? 'hop' : 'hops'}`}
              className='max-h-[45%] shrink-0'
            >
              <Hops hops={data.hops} />
            </Panel>
            <Panel
              title='Security headers'
              className='flex-1'
              actions={
                <Badge variant={gradeVariant(grade.grade)} className='mr-1.5'>
                  Grade {grade.grade} · {grade.score}/100
                </Badge>
              }
            >
              <table className='w-full text-xs'>
                <tbody>
                  {grade.checks.map((c) => (
                    <tr key={c.header} className='border-b last:border-0'>
                      <td className='w-7 py-1.5 pl-2.5 align-top'>{statusIcon[c.status]}</td>
                      <td className='px-2.5 py-1.5'>
                        <div className='font-medium'>{c.header}</div>
                        <div className='text-muted-foreground'>{c.note}</div>
                        {c.value && (
                          <div
                            className='mt-0.5 line-clamp-2 font-mono break-all text-muted-foreground'
                            title={c.value}
                          >
                            {c.value}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
          <div className='flex min-h-0 flex-col gap-2'>
            <Panel title='TLS' className='max-h-[55%] shrink-0'>
              {tlsHop?.tls ? (
                <TLSDetails tls={tlsHop.tls} hop={tlsHop} />
              ) : (
                <p className='p-2.5 text-xs text-muted-foreground'>No hop was served over HTTPS.</p>
              )}
            </Panel>
            <Panel
              title={`Response headers · ${final.status}`}
              className='flex-1'
              actions={<CopyButton value={() => headers.map(([k, v]) => `${k}: ${v}`).join('\n')} />}
            >
              <table className='w-full text-xs'>
                <tbody className='font-mono'>
                  {headers.map(([k, v], i) => (
                    <tr key={i} className='border-b last:border-0 hover:bg-muted/40'>
                      <th className='w-1/3 px-2.5 py-1 text-left align-top font-medium break-all'>{k}</th>
                      <td className='px-2.5 py-1 break-all text-muted-foreground'>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </Split>
      )}
    </Workspace>
  )
}
