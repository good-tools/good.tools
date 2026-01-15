import { useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import TextArea from "@/components/TextArea";
import { Buffer } from "buffer";
import {
  deserialize,
  normalize,
  print,
  type ClassDescription,
  type Content,
} from "@goodtools/jdserialize";
import { DarkModeContext } from "@/components/ModeToggle";
import Editor from "@monaco-editor/react";
import { XCircleIcon } from "@heroicons/react/24/outline";
import "allotment/dist/style.css";
import FileButton from "@/components/FileButton";
import { ObjectInspector } from "react-inspector";
import CheckBox from "@/components/CheckBox";

const EXAMPLE_OBJECT = Buffer.from(
  "aced0005737200136a6176612e7574696c2e41727261794c6973747881d21d99c7619d03000149000473697a6578700000000277040000000273720017746f6f6c732e676f6f642e6d6f64656c2e506572736f6e8fa1a2737c31b1840200044900036167654c00086368696c6472656e7400104c6a6176612f7574696c2f4c6973743b4c000667656e6465727400204c746f6f6c732f676f6f642f6d6f64656c2f506572736f6e2447656e6465723b4c00046e616d657400124c6a6176612f6c616e672f537472696e673b7870000000417371007e0000000000027704000000027371007e00020000001c7371007e000000000000770400000000787e72001e746f6f6c732e676f6f642e6d6f64656c2e506572736f6e2447656e64657200000000000000001200007872000e6a6176612e6c616e672e456e756d000000000000000012000078707400044d414c457400054f73616d617371007e00020000001e7371007e0000000000007704000000007871007e000c740008416264756c6c61687871007e000c7400064b68616c69647371007e0002000000327371007e0000000000017704000000017371007e000200000019707e71007e000a74000646454d414c4574000548617269737871007e000c740005417a66617278",
  "hex"
);

interface DeserializedObject {
  objects: unknown;
  classes: unknown;
}

function JavaDeserializer() {
  const { darkMode } = useContext(DarkModeContext);
  const [encoded, setEncoded] = useState("");
  const [decoded, setDecoded] = useState<DeserializedObject | null>(null);
  const [buffer, setBuffer] = useState<Buffer | null>(null);
  const [classes, setClasses] = useState("");
  const [data, setData] = useState("");

  const encodedRef = useRef<HTMLTextAreaElement>(null);

  const [connect, setConnect] = useState(true);
  const [tree, setTree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = () => {
    setConnect(!connect);
  };

  const handleTreeChange = () => {
    setTree(!tree);
  };

  const deserializeObject = () => {
    setDecoded(null);

    const trimmed = encoded.replace(/\s/g, "").replace(/0x/g, "").toLowerCase();
    const buff = Buffer.from(trimmed, "hex");

    setError(null);
    setEncoded(buff.toString("hex"));
    setBuffer(buff);
  };

  useEffect(() => {
    if (buffer === null) return;

    setDecoded(null);
    setError(null);

    try {
      setDecoded(deserialize(buffer, connect));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deserialization failed");
    }
  }, [connect, buffer]);

  useEffect(() => {
    if (decoded === null) return;

    try {
      setClasses(print((decoded as any).classes as ClassDescription[]));
    } catch (e) {
      setClasses(
        `// failed to dump classes: ${
          e instanceof Error ? e.message : "unknown error"
        }`
      );
    }

    try {
      setData(
        JSON.stringify(
          normalize((decoded as any).objects as Content[]),
          null,
          2
        )
      );
    } catch (e) {
      setData(
        `// failed to dump data: ${
          e instanceof Error ? e.message : "unknown error"
        }`
      );
    }
  }, [decoded]);

  const loadExample = () => {
    setError(null);
    setEncoded(EXAMPLE_OBJECT.toString("hex"));
    setDecoded(null);
  };

  const clear = () => {
    setBuffer(null);
    setError(null);
    setEncoded("");
    setDecoded(null);
  };

  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.addEventListener("load", (event) => {
      const result = event.target?.result;
      if (result instanceof ArrayBuffer) {
        setError(null);
        setEncoded(Buffer.from(result).toString("hex"));
        setDecoded(null);
      }
    });
    reader.readAsArrayBuffer(f);
  };

  useEffect(() => {
    encodedRef.current?.focus();
  }, [encodedRef]);

  return (
    <div>
      <TextArea
        ref={encodedRef}
        id="encoded"
        name="encoded"
        rows={6}
        value={encoded}
        onCtrlEnter={() => deserializeObject()}
        onChange={(e) => setEncoded(e.target.value)}
        className="font-mono text-xs"
        placeholder="Paste your serialized object as hex"
      />
      <div className="mt-3">
        <Button variant="filled" onClick={() => deserializeObject()}>
          Decode
        </Button>
        <FileButton variant="ghost" className="ml-5" onFileSelected={loadFile}>
          Load File
        </FileButton>
        <Button variant="text" className="ml-3" onClick={loadExample}>
          Load Example
        </Button>
        <Button variant="text" className="ml-3" onClick={clear}>
          Clear
        </Button>
      </div>
      <div className="mt-3 relative flex items-start">
        <CheckBox
          checked={connect}
          onChange={handleChange}
          title="Connect Classes"
        />
        <CheckBox
          className="ml-3"
          checked={tree}
          onChange={handleTreeChange}
          title="Instance Tree"
        />
      </div>
      {error != null && (
        <div className="rounded-md bg-red-50 p-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon
                className="h-5 w-5 text-red-400"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}
      {decoded != null && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            {tree ? (
              <div className="">
                <p className="text-xl p-3 pl-8">Object Tree</p>
                <ObjectInspector
                  data={decoded.objects}
                  theme={darkMode ? "chromeDark" : "chromeLight"}
                />
              </div>
            ) : (
              <>
                <p className="text-xl p-3 pl-8">Normalized Data</p>
                <Editor
                  height="50vh"
                  value={data}
                  theme={darkMode ? "vs-dark" : "light"}
                  defaultLanguage="json"
                  options={{
                    readOnly: true,
                    wordWrap: "on",
                    contextmenu: false,
                    minimap: {
                      enabled: false,
                    },
                  }}
                />
              </>
            )}
          </div>
          <div>
            <p className="text-xl p-3 pl-8">Dumped Classes</p>
            <Editor
              height="50vh"
              value={classes}
              theme={darkMode ? "vs-dark" : "light"}
              defaultLanguage="java"
              options={{
                readOnly: true,
                wordWrap: "on",
                contextmenu: false,
                minimap: {
                  enabled: false,
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default JavaDeserializer;
