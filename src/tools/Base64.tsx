import { useEffect, useRef } from "react";
import { Buffer } from "buffer";
import BufferTextArea from "@/components/BufferTextArea";
import { Tab } from "@headlessui/react";
import { CodeGroup } from "@/components/Code";
import TabButton from "@/components/TabButton";
import TextArea from "@/components/TextArea";
import { Button } from "@/components/ui/button";
import { useBase64Store } from "@/stores";

function Encoder() {
  const {
    encoderInput,
    setEncoderInput,
    encoderOutput,
    setEncoderOutput,
    resetEncoder,
  } = useBase64Store();
  const decodedRef = useRef<HTMLTextAreaElement>(null);

  const encode = () => {
    const val = Buffer.from(encoderInput, "utf8");
    setEncoderOutput(val);
  };

  const inline = () => {
    const val = Buffer.from(encoderInput, "utf8");
    setEncoderInput(val.toString("base64"));
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
          <code>{encoderOutput.toString("base64")}</code>
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
  } = useBase64Store();
  const encodedRef = useRef<HTMLTextAreaElement>(null);

  const decode = () => {
    try {
      const val = Buffer.from(decoderInput, "base64");
      setDecoderOutput(val);
    } catch (error) {
      console.error("Failed to decode base64:", error);
    }
  };

  const inline = () => {
    try {
      const val = Buffer.from(decoderInput, "base64");
      setDecoderInput(val.toString("utf8"));
    } catch (error) {
      console.error("Failed to decode base64:", error);
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
        placeholder={"Paste your base64 encoded data"}
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
      {decoderOutput && <BufferTextArea value={decoderOutput} />}
    </div>
  );
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
  );
}

export default Base64;
