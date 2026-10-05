import { Alert } from '@/components/ui/alert'
import { CopyButton } from '@/components/ui/copy-button'
import { Spinner } from '@/components/ui/spinner'
import { Panel } from '@/components/ui/toolbar'
import { useMyIPQuery } from '@/hooks/useApiQuery'

function WhatsMyIP() {
  const { data, isLoading, error } = useMyIPQuery()
  const rows: [string, string | undefined][] = [
    [data ? (data.ip.includes(':') ? 'IPv6' : 'IPv4') : 'IP', data?.ip],
    ['User agent', navigator.userAgent],
  ]

  return (
    <div className='flex max-w-3xl flex-col gap-2'>
      <Alert>{error?.message}</Alert>
      <Panel>
        <table className='w-full text-xs'>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className='h-8 border-b last:border-0'>
                <th className='w-28 px-2.5 text-left font-medium text-muted-foreground'>{label}</th>
                <td className='px-2.5 py-1 font-mono break-all'>
                  {value ?? (isLoading ? <Spinner label='Finding your IP address…' /> : '—')}
                </td>
                <td className='w-8 pr-1'>
                  {value && <CopyButton value={value} size='icon-sm' label={`Copy ${label}`} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

export default WhatsMyIP
