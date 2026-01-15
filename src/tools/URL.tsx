import { useEffect, useRef } from "react";
import { Tab } from "@headlessui/react";
import { CodeGroup } from "@/components/Code";
import TabButton from "@/components/TabButton";
import TextArea from "@/components/TextArea";
import { Button } from "@/components/ui/button";
import { useURLStore } from "@/stores";

function Encoder() {
  const {
    encoderInput,
    setEncoderInput,
    encoderOutput,
    setEncoderOutput,
    resetEncoder,
  } = useURLStore();
  const decodedRef = useRef<HTMLTextAreaElement>(null);

  const encode = () => {
    const val = encodeURIComponent(encoderInput);
    setEncoderOutput(val);
  };

  const inline = () => {
    const val = encodeURIComponent(encoderInput);
    setEncoderInput(val);
  };

  const clear = () => {
    resetEncoder();
  };

  useEffect(() => {
    decodedRef.current?.focus();
  }, []);

  return (
    <div>
      <TextArea
        ref={decodedRef}
        id="decoded"
        name="decoded"
        rows={8}
        value={encoderInput}
        onChange={(e) => setEncoderInput(e.target.value)}
        onCtrlEnter={() => encode()}
        placeholder={"Paste your data"}
      />
      <Button className="mt-3" onClick={() => encode()}>
        Encode
      </Button>
      <Button className="ml-2" variant="secondary" onClick={() => inline()}>
        Encode Inline
      </Button>
      <Button variant="ghost" className={"ml-3"} onClick={clear}>
        Clear
      </Button>
      {encoderOutput && (
        <CodeGroup title={"Result"}>
          <code>{encoderOutput}</code>
        </CodeGroup>
      )}
    </div>
  );
}

function Decoder() {
  const {
    decoderInput,
    setDecoderInput,
    decoderOutput,
    setDecoderOutput,
    resetDecoder,
  } = useURLStore();
  const encodedRef = useRef<HTMLTextAreaElement>(null);

  const decode = () => {
    try {
      const val = decodeURIComponent(decoderInput);
      setDecoderOutput(val);
    } catch (error) {
      console.error("Failed to decode URL:", error);
    }
  };

  const inline = () => {
    try {
      const val = decodeURIComponent(decoderInput);
      setDecoderInput(val);
    } catch (error) {
      console.error("Failed to decode URL:", error);
    }
  };

  const clear = () => {
    resetDecoder();
  };

  useEffect(() => {
    encodedRef.current?.focus();
  }, []);

  return (
    <div>
      <TextArea
        ref={encodedRef}
        id="encoded"
        name="encoded"
        rows={8}
        value={decoderInput}
        onChange={(e) => setDecoderInput(e.target.value)}
        onCtrlEnter={() => decode()}
        placeholder={"Paste your URL encoded data"}
      />
      <Button className="mt-3" onClick={() => decode()}>
        Decode
      </Button>
      <Button className="ml-2" variant="secondary" onClick={() => inline()}>
        Decode Inline
      </Button>
      <Button variant="ghost" className={"ml-3"} onClick={clear}>
        Clear
      </Button>
      {decoderOutput && (
        <CodeGroup title={"Result"}>
          <code>{decoderOutput}</code>
        </CodeGroup>
      )}
    </div>
  );
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
  );
}

export default URL;
