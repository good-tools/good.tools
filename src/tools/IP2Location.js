import { useState } from "react"
import { serviceBaseUrl } from "../tools";

const IP_REGEX = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;

function IP2Location() {
  const [ address, setAddress ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ data, setData ] = useState(null)

  const load = async () => {
    
    if (!IP_REGEX.test(address)) {
      return
    }

    setLoading(true)
    const res = await fetch(`${serviceBaseUrl}/ip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ip: address,
      })
    })

    const data = await res.json()

    data.address = address
    
    setData(data)
    setLoading(false)
  }

  return (
    <div>
      <div className="mt-5 sm:flex sm:items-center">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="ip" className="sr-only">
            Email
          </label>
          <input
            type="text"
            name="ip"
            id="ip"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="8.8.8.8"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete={"off"}
          />
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={load}
          className="disabled:opacity-50 mt-3 inline-flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
        >
          Lookup
        </button>
      </div>
      {data && (
        <div className="mt-3 overflow-hidden w-full bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">{data.address}</h3>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Country</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.country}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Region</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.region}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">City</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.city}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Timezone</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.timezone}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

export default IP2Location