import { useEffect, useRef, useState } from "react"
import { Buffer } from "buffer"
import BufferTextArea from "../components/BufferTextArea"
import { Tab } from '@headlessui/react'
import { CodeGroup } from "../components/Code"
import TabButton from "../components/TabButton"
import TextArea from "../components/TextArea"
import { Button } from "../components/Button"

function Encoder() {
  const [ encoded, setEncoded ] = useState(null)
  const [ decoded, setDecoded ] = useState('')
  const decodedRef = useRef();

  const encode = () => {
    const val = Buffer.from(decoded, 'utf8');
    setEncoded(val)
  }

  const inline = () => {
    const val = Buffer.from(decoded, 'utf8');
    setDecoded(val.toString('base64'))
  }

  const clear = () => {
    setEncoded(null)
    setDecoded('')
  }

  useEffect(() => {
    decodedRef.current.focus()
  }, [ decodedRef ])

  return (
    <div>
      <TextArea
        innerRef={decodedRef}
        id="decoded"
        name="decoded"
        rows={8}
        value={decoded}
        onChange={e => setDecoded(e.target.value)}
        onCtrlEnter={() => encode()}
        placeholder={'Paste your data'}
      />
      <Button
        className="mt-3"
        variant="filled"
        onClick={() => encode()}
      >
        Encode
      </Button>
      <Button
        className="ml-2"
        variant="secondary"
        onClick={() => inline()}
      >
        Encode Inline
      </Button>
      <Button variant="text" className={"ml-3"} onClick={clear}>Clear</Button>
      {encoded && (
        <CodeGroup title={"Result"}>
          <code code={encoded.toString('base64')}>{encoded.toString('base64')}</code>
        </CodeGroup>
      )}
    </div>
  )
}

function Decoder() {
  const [ encoded, setEncoded ] = useState('')
  const [ decoded, setDecoded ] = useState(null)
  const encodedRef = useRef()

  const decode = () => {
    const val = Buffer.from(encoded, 'base64');
    setDecoded(val)
  }

  const inline = () => {
    const val = Buffer.from(encoded, 'base64');
    setEncoded(val.toString('utf8'))
  }

  const clear = () => {
    setDecoded(null)
    setEncoded('')
  }

  useEffect(() => {
    encodedRef.current.focus()
  }, [ encodedRef ])

  return (
    <div>
      <TextArea
        innerRef={encodedRef}
        id="encoded"
        name="encoded"
        rows={8}
        value={encoded}
        onChange={e => setEncoded(e.target.value)}
        onCtrlEnter={() => decode()}
        placeholder={'Paste your base64 encoded data'}
      />
      <Button
        className="mt-3"
        variant="filled"
        onClick={() => decode()}
      >
        Decode
      </Button>
      <Button
        className="ml-2"
        variant="secondary"
        onClick={() => inline()}
      >
        Decode Inline
      </Button>
      <Button variant="text" className={"ml-3"} onClick={clear}>Clear</Button>
      {decoded && (
        <BufferTextArea value={decoded} />
      )}
    </div>
  )
}

function Base64() {
  return (
    <Tab.Group>
      <Tab.List className="flex space-x-4">
        <TabButton>Encoder</TabButton>
        <TabButton>Decoder</TabButton>
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