import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import TextArea from "@/components/TextArea";
import { Buffer } from "buffer";
import {
  decode,
  typeDefinition,
  possibleValues,
} from "@goodtools/protobuf-decoder";
import { Tag } from "@/components/Tag";
import CheckBox from "@/components/CheckBox";

const EXAMPLE_PROTOBUF = Buffer.from([
  0x08, 0x8f, 0x81, 0xeb, 0xcf, 0xe0, 0x2a, 0x12, 0x08, 0x6b, 0x6f, 0x74, 0x6c,
  0x69, 0x6e, 0x34, 0x36, 0x3a, 0x05, 0x00, 0x01, 0x03, 0x04, 0x07, 0x42, 0x00,
  0x48, 0xfa, 0x01, 0x55, 0x00, 0x00, 0x48, 0x43, 0x72, 0x0a, 0x0a, 0x08, 0x50,
  0x4f, 0x4b, 0x45, 0x43, 0x4f, 0x49, 0x4e, 0x72, 0x0c, 0x0a, 0x08, 0x53, 0x54,
  0x41, 0x52, 0x44, 0x55, 0x53, 0x54, 0x10, 0x64,
]);

interface ProtobufField {
  field: number;
  type: number;
  value: any;
  object?: boolean;
}

interface ProtobufObject {
  fields: ProtobufField[];
  unprocessed: Buffer;
}

interface ProtobufObjectProps {
  object: ProtobufObject;
  showBytes: boolean;
}

function ProtobufObjectComponent({ object, showBytes }: ProtobufObjectProps) {
  if (object.fields.length <= 0) {
    return (
      <div className="text-gray-500 font-mono text-xs">
        No fields exist for this object
      </div>
    );
  }

  return (
    <div className="my-2 flex flex-col">
      <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div className="overflow-hidden dark:bg-zinc-800 shadow dark:shadow-zinc-900 ring-1 ring-black dark:ring-zinc-900 ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50 dark:bg-zinc-700">
                <tr>
                  <th
                    scope="col"
                    className="py-2 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6"
                  >
                    Field
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-left text-sm font-semibold"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-left text-sm font-semibold"
                  >
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {object.fields.map((f, i) => (
                  <tr key={`k-${i}`}>
                    <td className="py-2 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                      {f.field}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {typeDefinition(f.type).name}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {f.object ? (
                        <ProtobufObjectComponent
                          object={f.value}
                          showBytes={showBytes}
                        />
                      ) : (
                        <table>
                          <tbody className="break-all">
                            {possibleValues(f)
                              .filter((p: any) => {
                                if (p.type === "bytes" && !showBytes)
                                  return false;
                                return true;
                              })
                              .map((p: any, j: number) => (
                                <tr key={`k-${i}-p-${j}`}>
                                  <td className="min-w-[100px]">
                                    <Tag>{p.type}</Tag>
                                  </td>
                                  {p.type === "bytes" ? (
                                    <td className="font-mono text-gray-600 text-xs">
                                      {p.value.toString()}
                                    </td>
                                  ) : (
                                    <td>{p.value.toString()}</td>
                                  )}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {object.unprocessed.length > 0 && (
                <tfoot className="divide-y divide-gray-200 dark:divide-gray-500">
                  <tr>
                    <td className="py-2 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                      Unprocessed
                    </td>
                    <td colSpan={2} className="px-2 py-2 text-xs">
                      {object.unprocessed.toString("hex")}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtobufDecoder() {
  const [encoded, setEncoded] = useState("");
  const [decoded, setDecoded] = useState<ProtobufObject | null>(null);
  const encodedRef = useRef<HTMLTextAreaElement>(null);

  const [checked, setChecked] = useState(false);

  const handleChange = () => {
    setChecked(!checked);
  };

  const decodeProto = () => {
    try {
      const trimmed = encoded
        .replace(/\s/g, "")
        .replace(/0x/g, "")
        .toLowerCase();
      const buff = Buffer.from(trimmed, "hex");

      setEncoded(buff.toString("hex"));
      setDecoded(decode(buff) as ProtobufObject);
    } catch (error) {
      console.error("Failed to decode protobuf:", error);
      setDecoded(null);
    }
  };

  const loadExample = () => {
    setEncoded(EXAMPLE_PROTOBUF.toString("hex"));
    setDecoded(null);
  };

  const clear = () => {
    setEncoded("");
    setDecoded(null);
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
        value={encoded}
        onCtrlEnter={() => decodeProto()}
        onChange={(e) => setEncoded(e.target.value)}
        className="font-mono text-xs"
        placeholder={"Paste your protobuf request as hex"}
      />
      <div className="mt-3">
        <Button onClick={() => decodeProto()}>Decode</Button>
        <Button variant="ghost" className={"ml-5"} onClick={loadExample}>
          Load Example
        </Button>
        <Button variant="ghost" className={"ml-3"} onClick={clear}>
          Clear
        </Button>
      </div>
      <CheckBox
        className={"mt-3"}
        checked={checked}
        onChange={handleChange}
        title="Show string bytes"
      />
      {decoded != null && (
        <div className="mt-3">
          <ProtobufObjectComponent object={decoded} showBytes={checked} />
        </div>
      )}
    </div>
  );
}

export default ProtobufDecoder;
