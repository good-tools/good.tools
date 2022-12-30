import { useEffect, useState } from "react"
import { internetToolsBaseUrl, serviceBaseUrl } from "../tools"

function WhatsMyIP() {

  const [ loading, setLoading ] = useState(true)
  const [ loadingV6, setLoadingV6 ] = useState(true)
  const [ dataV6, setDataV6 ] = useState(null)
  const [ data, setData ] = useState(null)

  const loadV6 = async () => {
    const res = await fetch(`${internetToolsBaseUrl}/my-ip`)
    const data = await res.json()

    setDataV6(data)
    setLoadingV6(false)
  }

  const load = async () => {
    const res = await fetch(`${serviceBaseUrl}/ip`)
    const data = await res.json()

    setData(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    loadV6()
  }, [])

  if (loading || loadingV6) {
    return (
      <div>Please wait while we find out your IP address.</div>
    )
  }

  const ips = [...new Set([data.ip, dataV6.ip])]

  return (
    <div className="mt-3 overflow-hidden w-full dark:bg-zinc-800 shadow dark:shadow-zinc-900 sm:rounded-lg">
      <div className="border-gray-200 px-4 py-5 sm:px-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">IP Address</dt>
            <dd className="mt-1 text-sm">
              <ul>
                {ips.map((ip, i) => (
                  <li key={i} className="py-1">{ip}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">User Agent</dt>
            <dd className="mt-1 text-sm">{data.agent}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default WhatsMyIP