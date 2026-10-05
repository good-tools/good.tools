import { ExternalLink, MapPin, Search, Shuffle, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useIPLocationQuery, useMyIPQuery, useSubmittedQuery } from '@/hooks/useApiQuery'

const EXAMPLE_IPS = ['8.8.8.8', '1.1.1.1', '9.9.9.9', '208.67.222.222', '151.101.1.140']

const dash = <span className='text-muted-foreground'>—</span>

function IP2Location() {
  const [submitted, submit] = useSubmittedQuery()
  const [address, setAddress] = useState(submitted)
  const { data, isFetching, error, refetch } = useIPLocationQuery(submitted)
  const myIP = useMyIPQuery()

  const lookup = (value: string) => {
    const ip = value.trim()
    setAddress(ip)
    if (ip && ip === submitted) void refetch()
    else submit(ip)
  }

  const clear = () => {
    setAddress('')
    submit('')
  }

  const rows: [string, ReactNode, string?][] = data
    ? [
        ['IP', data.ip, data.ip],
        ['Continent', data.continent || dash],
        ['Country', data.country || dash],
        ['Region', data.subdivisions?.join(', ') || dash],
        ['City', data.city || dash],
        ['Postal code', data.postal_code || dash],
        ['Timezone', data.time_zone || dash],
        [
          'Coordinates',
          <>
            {data.location.lat}, {data.location.lng}{' '}
            <span className='text-muted-foreground'>±{data.location.accuracy} km</span>{' '}
            <a
              className='inline-flex items-center gap-0.5 font-sans underline underline-offset-2 hover:text-foreground'
              target='_blank'
              rel='noreferrer'
              href={`https://www.openstreetmap.org/?mlat=${data.location.lat}&mlon=${data.location.lng}#map=10/${data.location.lat}/${data.location.lng}`}
            >
              OpenStreetMap <ExternalLink className='size-3' />
            </a>
          </>,
          `${data.location.lat}, ${data.location.lng}`,
        ],
        ['ASN', `AS${data.asn.number} ${data.asn.organization}`, `AS${data.asn.number}`],
        [
          'Traits',
          <span className='flex gap-1 font-sans'>
            <Badge variant={data.traits.anonymous_proxy ? 'warning' : 'outline'}>
              Anonymous proxy: {data.traits.anonymous_proxy ? 'yes' : 'no'}
            </Badge>
            <Badge variant={data.traits.satellite_provider ? 'warning' : 'outline'}>
              Satellite: {data.traits.satellite_provider ? 'yes' : 'no'}
            </Badge>
          </span>,
        ],
      ]
    : []

  return (
    <Workspace
      toolbar={
        <>
          <Input
            autoFocus
            aria-label='IP address'
            className='max-w-md flex-1 font-mono'
            placeholder='8.8.8.8'
            value={address}
            onEnter={() => lookup(address)}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete='off'
          />
          <Button size='sm' onClick={() => lookup(address)} disabled={isFetching || !address.trim()}>
            <Search /> Lookup
          </Button>
          <Button
            variant='ghost'
            size='sm'
            disabled={isFetching || !myIP.data}
            onClick={() => myIP.data && lookup(myIP.data.ip)}
          >
            <MapPin /> My IP
          </Button>
          <Button
            variant='ghost'
            size='sm'
            disabled={isFetching}
            onClick={() => setAddress(EXAMPLE_IPS[Math.floor(Math.random() * EXAMPLE_IPS.length)] ?? '')}
          >
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
        <Panel title='Location' className='max-w-3xl'>
          <table className='w-full text-xs'>
            <tbody>
              {rows.map(([label, value, copy]) => (
                <tr key={label} className='h-7 border-b last:border-0'>
                  <th className='w-32 px-2.5 text-left font-medium text-muted-foreground'>{label}</th>
                  <td className='px-2.5 font-mono break-all'>{value}</td>
                  <td className='w-8 pr-1'>
                    {copy && <CopyButton value={copy} size='icon-sm' label={`Copy ${label}`} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className='border-t px-2.5 py-1.5 text-[11px] text-muted-foreground'>
            MaxMind GeoLite2-City ({data.build.city}) and GeoLite2-ASN ({data.build.asn}).
          </p>
        </Panel>
      ) : (
        !isFetching &&
        !error && <p className='text-xs text-muted-foreground'>Enter an IPv4 or IPv6 address to locate it.</p>
      )}
    </Workspace>
  )
}

export default IP2Location
