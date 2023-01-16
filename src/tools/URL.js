import { useEffect, useRef } from "react"
import { Tab } from '@headlessui/react'
import { CodeGroup } from "../components/Code"
import TabButton from "../components/TabButton"
import TextArea from "../components/TextArea"
import { Button } from "../components/Button"
import create from 'zustand'

const useEncoderStore = create((set) => ({
  encoded: null,
  decoded: '',
  setEncoded: (encoded) => set(() => ({ encoded: encoded })),
  setDecoded: (decoded) => set(() => ({ decoded: decoded })),
  reset: () => set(() => ({ decoded: '', encoded: null })),
}))

const useDecoderStore = create((set) => ({
  encoded: '',
  decoded: null,
  setEncoded: (encoded) => set(() => ({ encoded: encoded })),
  setDecoded: (decoded) => set(() => ({ decoded: decoded })),
  reset: () => set(() => ({ decoded: null, encoded: '' })),
}))

function Encoder() {
  const state = useEncoderStore()

  const decodedRef = useRef();

  const encode = () => {
    const val = encodeURIComponent(state.decoded);
    state.setEncoded(val)
  }

  const inline = () => {
    const val = encodeURIComponent(state.decoded);
    state.setDecoded(val)
  }

  const clear = () => {
    state.reset();
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
        value={state.decoded}
        onChange={e => state.setDecoded(e.target.value)}
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
      {state.encoded && (
        <CodeGroup title={"Result"}>
          <code code={state.encoded}>{state.encoded}</code>
        </CodeGroup>
      )}
    </div>
  )
}

function Decoder() {
  const state = useDecoderStore()
  const encodedRef = useRef()

  const decode = () => {
    const val = decodeURIComponent(state.encoded);
    state.setDecoded(val)
  }

  const inline = () => {
    const val = decodeURIComponent(state.encoded);
    state.setEncoded(val)
  }

  const clear = () => {
    state.reset();
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
        value={state.encoded}
        onChange={e => state.setEncoded(e.target.value)}
        onCtrlEnter={() => decode()}
        placeholder={'Paste your URL encoded data'}
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
      {state.decoded && (
        <CodeGroup title={"Result"}>
          <code code={state.decoded}>{state.decoded}</code>
        </CodeGroup>
      )}
    </div>
  )
}

function URL() {
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

export default URL