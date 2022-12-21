import { useState } from "react"
import { pki } from "node-forge"
import moment from "moment"

function CertificateDecoder() {

  const [ encoded, setEncoded ] = useState('')
  const [ decoded, setDecoded ] = useState(null)

  const decode = () => {
    try {
      const data = pki.certificateFromPem(encoded)
      console.log(data)
      setDecoded(data)
    } catch (err) {
      // TODO: do something about it
      console.log(err)
      setDecoded(null)
    }
  }

  return (
    <div>
      <textarea
        id="encoded"
        name="encoded"
        rows={8}
        className="block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        value={encoded}
        onChange={e => setEncoded(e.target.value)}
        placeholder={'Paste your PEM encoded certificate here'}
      />
      <button
        type="button"
        onClick={() => decode()}
        className="inline-flex items-center rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Decode
      </button>
      {decoded !== null && (
        <div className="mt-3 overflow-hidden w-full bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Certificate</h3>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Subject</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {decoded.subject.attributes.map(a => (
                    <span className="pr-2"><strong>{a.shortName}</strong> = {a.value}</span>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Issuer</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {decoded.issuer.attributes.map(a => (
                    <span className="pr-2"><strong>{a.shortName}</strong> = {a.value}</span>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Valid From</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {moment(decoded.validity.notBefore).format("dddd, MMMM Do YYYY, h:mm:ss A")}
                  <div className="text-gray-500">({moment(decoded.validity.notBefore).fromNow()})</div>
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Valid To</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {moment(decoded.validity.notAfter).format("dddd, MMMM Do YYYY, h:mm:ss A")}
                  <div className="text-gray-500">({moment(decoded.validity.notAfter).fromNow()})</div>
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Serial</dt>
                <dd className="mt-1 text-sm text-gray-900">{decoded.serialNumber}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Extensions</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {decoded.extensions.map(e => (
                    <ol>
                      <span className="font-bold">{e.name}</span>
                      <ul className="ml-3">
                      {Object.keys(e).filter(k => !["value", "id", "name"].includes(k)).map(k => (
                        <li>
                          {k === "altNames" && (
                            <>{k} = {e[k].map(o => o.value).join(", ")}</>
                          )}
                          {k !== "altNames" && (
                            <>{k} = {e[k].toString()}</>
                          )}
                        </li>
                      ))}
                      </ul>
                    </ol>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Public Key</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <pre>
                    {pki.publicKeyToPem(decoded.publicKey)}
                  </pre>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

export default CertificateDecoder