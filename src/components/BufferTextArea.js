import { CodeGroup } from "./Code"

function BufferTextArea({ value, ...props }) {
  const hex = value.toString('hex')
  const b64 = value.toString('base64')
  const plain = value.toString('utf8')
  return (
    <CodeGroup {...props}>
      <code title="UTF-8" code={plain}>{plain}</code>
      <code title="Hex" code={hex}>{hex}</code>
      <code title="Base64" code={b64}>{b64}</code>
    </CodeGroup>
  )
}

export default BufferTextArea