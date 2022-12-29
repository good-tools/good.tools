import { XCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react"
import { internetToolsBaseUrl } from "../tools";

function IP2Location() {
  const [ address, setAddress ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ data, setData ] = useState(null)
  const [ error, setError ] = useState(null)
  const addressRef = useRef()

  const load = async () => {
    setData(null)
    setError(null)
    setLoading(true)

    const params = {
      ip: address
    }

    try {
      const response = await fetch(`${internetToolsBaseUrl}/ip?${new URLSearchParams(params)}`)
      const data = await response.json()
      if (response.status >= 400 && response.status < 600) {
        throw new Error(data.message);
      }
      setData(data)
      setLoading(false)
    } catch (e) {
      setLoading(false)
      setError(e.message)
    }
  }

  useEffect(() => {
    addressRef.current.focus()
  }, [addressRef])

  return (
    <div>
      <div className="mt-5 sm:flex sm:items-center">
        <div className="w-full">
          <input
            ref={addressRef}
            type="text"
            name="ip"
            id="ip"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="8.8.8.8"
            value={address}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                load()
              }
            }}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete={"off"}
          />
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={load}
          className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
        >
          {loading ? (
            <svg aria-hidden="true" className="w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-gray-500" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
              <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
            </svg>
          ) : (
            <>Lookup</>
          )}
        </button>
      </div>
      {error != null && (
        <div className="rounded-md bg-red-50 p-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}
      {data && (
        <>
          <div className="mt-3 overflow-hidden w-full bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">{data.ip}</h3>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Continent</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.continent || "Not Found"}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Country</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.country || "Not Found"}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Region</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.subdivisions.join(", ") || "Not Found"}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">City</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.city || "Not Found"}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Timezone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.time_zone}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Location</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.location.lat}, {data.location.lng} ({data.location.accuracy} KM, {data.postal_code})</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Traits</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <ul>
                      <li className="flex">
                        <div className="w-32">Anonymous Proxy</div>
                        <div className="text-gray-600 font-bold">{data.traits.anonymous_proxy ? "Yes" : "No"}</div>
                      </li>
                      <li className="flex">
                        <div className="w-32">Satellite Provider</div>
                        <div className="text-gray-600 font-bold">{data.traits.satellite_provider ? "Yes" : "No"}</div>
                      </li>
                    </ul>
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">ASN</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.asn.organization} ({data.asn.number})</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="mt-3 w-full bg-gray-100 shadow sm:rounded-lg p-4 text-sm text-gray-600">
            <p>This service uses the following MaxMind's GeoLite2 databases:</p>
            <ul className="mt-2">
              <li className="flex">
                <div className="w-32">GeoLite2-City</div>
                <div className="text-gray-600 font-bold">{data.build.city}</div>
              </li>
              <li className="flex">
                <div className="w-32">GeoLite2-ASN</div>
                <div className="text-gray-600 font-bold">{data.build.asn}</div>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

export default IP2Location