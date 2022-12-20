import { useEffect, useState } from "react"
import { serviceBaseUrl } from "../tools"

function WhatsMyIP() {

  const [ loading, setLoading ] = useState(true)
  const [ data, setData ] = useState(null)

  const load = async () => {
    const res = await fetch(`${serviceBaseUrl}/ip`)
    const data = await res.json()

    setData(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  })

  if (loading) {
    return (
      <div>Please wait while we find out your IP address.</div>
    )
  }

  return (
    <div className="mt-3 overflow-hidden w-full bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">My IP Address</h3>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">IP</dt>
            <dd className="mt-1 text-sm text-gray-900">{data.ip}</dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">User Agent</dt>
            <dd className="mt-1 text-sm text-gray-900">{data.agent}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default WhatsMyIP