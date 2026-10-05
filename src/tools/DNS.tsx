import { Search, Shuffle, X } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { EXAMPLE_DOMAINS, shortTTL, useDNSQuery, useSubmittedQuery } from '@/hooks/useApiQuery'

function DNS() {
  const [submitted, submit] = useSubmittedQuery()
  const [address, setAddress] = useState(submitted)
  const { data, isFetching, error, refetch } = useDNSQuery(submitted)

  const load = () => {
    const domain = address.trim()
    if (domain && domain === submitted) void refetch()
    else submit(domain)
  }

  const clear = () => {
    setAddress('')
    submit('')
  }

  const loadRandom = () => setAddress(EXAMPLE_DOMAINS[Math.floor(Math.random() * EXAMPLE_DOMAINS.length)] ?? '')

  const rows = Object.entries(data ?? {}).flatMap(([type, records]) =>
    records.map((r) => ({ type, value: r.priority ? `${r.priority} ${r.content}` : r.content, ttl: r.ttl })),
  )

  return (
    <Workspace
      toolbar={
        <>
          <Input
            autoFocus
            aria-label='Domain'
            className='max-w-md flex-1'
            placeholder='example.com'
            value={address}
            onEnter={load}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete='off'
          />
          <Button size='sm' onClick={load} disabled={isFetching || !address.trim()}>
            <Search /> Lookup
          </Button>
          <Button variant='ghost' size='sm' disabled={isFetching} onClick={loadRandom}>
            <Shuffle /> Random example
          </Button>
          <Button variant='ghost' size='sm' disabled={isFetching || !address} onClick={clear}>
            <X /> Clear
          </Button>
          {isFetching && <Spinner label='Looking up…' />}
        </>
      }
    >
      <Alert>{error?.message}</Alert>
      {!data ? (
        !isFetching && !error && <p className='text-xs text-muted-foreground'>Enter a domain to look up its records.</p>
      ) : rows.length === 0 ? (
        <p className='text-xs text-muted-foreground'>No records found for {submitted}.</p>
      ) : (
        <Panel
          title={`${rows.length} records`}
          actions={
            <CopyButton value={() => rows.map((r) => `${submitted}\t${r.ttl}\t${r.type}\t${r.value}`).join('\n')} />
          }
        >
          <table className='w-full text-xs'>
            <thead className='sticky top-0 bg-card text-left text-muted-foreground'>
              <tr className='h-7 border-b'>
                <th className='w-16 px-2.5 font-medium'>Type</th>
                <th className='px-2.5 font-medium'>Name</th>
                <th className='px-2.5 font-medium'>Value</th>
                <th className='w-16 px-2.5 text-right font-medium'>TTL</th>
                <th className='w-8' />
              </tr>
            </thead>
            <tbody className='font-mono'>
              {rows.map((r, i) => (
                <tr key={i} className='h-7 border-b last:border-0 hover:bg-muted/40'>
                  <td className='px-2.5 font-sans font-medium'>{r.type !== rows[i - 1]?.type && r.type}</td>
                  <td className='px-2.5 whitespace-nowrap text-muted-foreground'>{submitted}</td>
                  <td className='px-2.5 break-all'>{r.value}</td>
                  <td className='px-2.5 text-right text-muted-foreground'>{shortTTL(r.ttl)}</td>
                  <td className='pr-1'>
                    <CopyButton value={r.value} size='icon-sm' label={`Copy ${r.type} value`} />
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

export default DNS
