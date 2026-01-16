import { useMyIPQuery, useMyIPv6Query } from '@/hooks/useApiQuery'

function WhatsMyIP() {
  const { data: dataV4, isLoading: loadingV4 } = useMyIPQuery()
  const { data: dataV6, isLoading: loadingV6 } = useMyIPv6Query()

  if (loadingV4 || loadingV6) {
    return <div>Please wait while we find out your IP address.</div>
  }

  // Combine unique IPs from both sources
  const ips = [...(dataV4?.ip ? [dataV4.ip] : []), ...(dataV6?.ip ? [dataV6.ip] : [])]
  const uniqueIps = [...new Set(ips)]

  return (
    <div className='mt-3 overflow-hidden w-full dark:bg-zinc-800 shadow dark:shadow-zinc-900 sm:rounded-lg'>
      <div className='border-gray-200 px-4 py-5 sm:px-6'>
        <dl className='grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2'>
          <div className='sm:col-span-1'>
            <dt className='text-sm font-medium text-gray-500'>IP Address</dt>
            <dd className='mt-1 text-sm'>
              <ul>
                {uniqueIps.map((ip, i) => (
                  <li key={i} className='py-1'>
                    {ip}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div className='sm:col-span-1'>
            <dt className='text-sm font-medium text-gray-500'>User Agent</dt>
            <dd className='mt-1 text-sm'>{dataV4?.agent}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default WhatsMyIP
