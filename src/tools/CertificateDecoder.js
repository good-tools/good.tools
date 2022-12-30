import { useEffect, useRef, useState } from "react"
import { pki } from "node-forge"
import moment from "moment"
import { CodeGroup } from "../components/Code"
import { Button } from "../components/Button"
import TextArea from "../components/TextArea"

function CertificateDecoder() {

  const [ encoded, setEncoded ] = useState('')
  const [ decoded, setDecoded ] = useState(null)
  const encodedRef = useRef()

  const decode = () => {
    try {
      const data = pki.certificateFromPem(encoded)
      setDecoded(data)
    } catch (err) {
      setDecoded(null)
    }
  }

  useEffect(() => {
    encodedRef.current.focus()
  }, [encodedRef])

  return (
    <div>
      <TextArea
        innerRef={encodedRef}
        id="encoded"
        name="encoded"
        rows={8}
        value={encoded}
        onCtrlEnter={() => decode()}
        onChange={e => setEncoded(e.target.value)}
        className="font-mono text-xs"
        placeholder={'Paste your PEM encoded certificate here'}
      />
      <Button
        variant="filled"
        onClick={() => decode()}
        className="mt-3"
      >
        Decode
      </Button>
      {decoded !== null && (
        <div className="mt-3 overflow-hidden w-full dark:bg-zinc-800 shadow dark:shadow-zinc-900 sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium leading-6">Certificate</h3>
          </div>
          <div className="border-t border-gray-200 dark:border-zinc-700 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Subject</dt>
                <dd className="mt-1 text-sm">
                  {decoded.subject.attributes.map((a, i) => (
                    <span key={`sb-${i}`} className="pr-2"><strong>{a.shortName}</strong> = {a.value}</span>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Issuer</dt>
                <dd className="mt-1 text-sm">
                  {decoded.issuer.attributes.map((a, i) => (
                    <span key={`is-${i}`}  className="pr-2"><strong>{a.shortName}</strong> = {a.value}</span>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Valid From</dt>
                <dd className="mt-1 text-sm">
                  {moment(decoded.validity.notBefore).format("dddd, MMMM Do YYYY, h:mm:ss A")}
                  <div className="text-gray-500">({moment(decoded.validity.notBefore).fromNow()})</div>
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Valid To</dt>
                <dd className="mt-1 text-sm">
                  {moment(decoded.validity.notAfter).format("dddd, MMMM Do YYYY, h:mm:ss A")}
                  <div className="text-gray-500">({moment(decoded.validity.notAfter).fromNow()})</div>
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Serial</dt>
                <dd className="mt-1 text-sm">{decoded.serialNumber}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Extensions</dt>
                <dd className="mt-1 text-sm">
                  {decoded.extensions.map((e, i) => (
                    <ol key={`ex-${i}`}>
                      <span className="font-bold">{e.name}</span>
                      <ul className="ml-3">
                      {Object.keys(e).filter(k => !["value", "id", "name"].includes(k)).map(k => (
                        <li key={`ex-${i}-${k}`}>
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
                <dd className="mt-1 text-sm">
                  <CodeGroup>
                    <code>{pki.publicKeyToPem(decoded.publicKey)}</code>
                  </CodeGroup>
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