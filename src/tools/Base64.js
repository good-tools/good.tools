import { useEffect, useRef, useState } from "react"
import { Buffer } from "buffer"
import BufferTextArea from "../components/BufferTextArea"
import { Tab } from '@headlessui/react'
import clsx from "clsx"
import { CodeGroup } from "../components/Code"

function Encoder() {
  const [ encoded, setEncoded ] = useState('')
  const [ decoded, setDecoded ] = useState('')
  const decodedRef = useRef();

  const encode = () => {
    const val = Buffer.from(decoded, 'utf8');
    setEncoded(val)
  }

  useEffect(() => {
    decodedRef.current.focus()
  }, [ decodedRef ])

  return (
    <div>
      <textarea
        ref={decodedRef}
        id="decoded"
        name="decoded"
        rows={8}
        className="block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        value={decoded}
        onChange={e => setDecoded(e.target.value)}
        placeholder={'Paste your data'}
      />
      <button
        type="button"
        onClick={() => encode()}
        className="inline-flex items-center rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Encode
      </button>
      <CodeGroup title={"Base64"}>
        <code code={encoded.toString('base64')}>{encoded.toString('base64')}</code>
      </CodeGroup>
    </div>
  )
}

function Decoder() {
  const [ encoded, setEncoded ] = useState('')
  const [ decoded, setDecoded ] = useState('')
  const encodedRef = useRef()

  const decode = () => {
    const val = Buffer.from(encoded, 'base64');
    setDecoded(val)
  }

  useEffect(() => {
    encodedRef.current.focus()
  }, [ encodedRef ])

  return (
    <div>
      <textarea
        ref={encodedRef}
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
      <BufferTextArea value={decoded} />
    </div>
  )
}

function Base64() {
  return (
    <Tab.Group>
      <Tab.List className="flex space-x-4">
        <Tab className={({ selected }) => clsx(
            selected ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700',
            'px-3 py-2 font-medium text-sm rounded-md'
        )}>Encoder</Tab>
        <Tab className={({ selected }) => clsx(
            selected ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700',
            'px-3 py-2 font-medium text-sm rounded-md'
        )}>Decoder</Tab>
      </Tab.List>
      <Tab.Panels className="mt-2">
        <Tab.Panel>
          <Encoder />
        </Tab.Panel>
        <Tab.Panel>
          <Decoder />
        </Tab.Panel>
      </Tab.Panels>
    </Tab.Group>
  )
}

export default Base64