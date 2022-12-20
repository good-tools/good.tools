import { useState } from "react"
import { Buffer } from "buffer"

function Base64() {
  const [ encoded, setEncoded ] = useState('')
  const [ decoded, setDecoded ] = useState('')

  const decode = () => {
    const val = Buffer.from(encoded, 'base64');
    setDecoded(val.toString('utf8'))
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
        placeholder={'Paste your base64 encoded data'}
      />
      <button
        type="button"
        onClick={() => decode()}
        className="inline-flex items-center rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Decode
      </button>
      <textarea
        id="decoded"
        name="decoded"
        disabled
        rows={8}
        className="block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        value={decoded}
      />
    </div>
  )
}

export default Base64