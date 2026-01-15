import { CodeGroup } from "./Code";

interface BufferTextAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  value: Buffer;
}

function BufferTextArea({ value, ...props }: BufferTextAreaProps) {
  const hex = value.toString("hex");
  const b64 = value.toString("base64");
  const plain = value.toString("utf8");

  return (
    <CodeGroup {...props}>
      <code title="UTF-8">{plain}</code>
      <code title="Hex">{hex}</code>
      <code title="Base64">{b64}</code>
    </CodeGroup>
  );
}

export default BufferTextArea;
