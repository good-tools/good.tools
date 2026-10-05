import { Search, Shuffle, X } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { EXAMPLE_DOMAINS, useSubmittedQuery, useWhoisQuery } from '@/hooks/useApiQuery'

function Whois() {
  const [submitted, submit] = useSubmittedQuery()
  const [address, setAddress] = useState(submitted)
  const { data, isFetching, error, refetch } = useWhoisQuery(submitted)

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
      {data ? (
        <Panel className='flex-1' title={`WHOIS · ${submitted}`} actions={<CopyButton value={data.data} />}>
          <pre className='p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap'>
            {data.data.replace(/\r/g, '').replace(/^\n+|\s+$/g, '')}
          </pre>
        </Panel>
      ) : (
        !isFetching &&
        !error && <p className='text-xs text-muted-foreground'>Enter a domain to see its WHOIS record.</p>
      )}
    </Workspace>
  )
}

export default Whois
