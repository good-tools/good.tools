import { type ClassDescription, type Content, deserialize, normalize, print } from '@goodtools/jdserialize'
import { Buffer } from 'buffer'
import { Eraser, FileUp, FlaskConical, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { JsonTree, useJsonTree } from '@/components/JsonTree'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CodeEditor } from '@/components/ui/code-editor'
import { CopyButton } from '@/components/ui/copy-button'
import { FileButton } from '@/components/ui/file-button'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { parseHex } from '@/lib/hex'

const EXAMPLE_OBJECT = Buffer.from(
  'aced0005737200136a6176612e7574696c2e41727261794c6973747881d21d99c7619d03000149000473697a6578700000000277040000000273720017746f6f6c732e676f6f642e6d6f64656c2e506572736f6e8fa1a2737c31b1840200044900036167654c00086368696c6472656e7400104c6a6176612f7574696c2f4c6973743b4c000667656e6465727400204c746f6f6c732f676f6f642f6d6f64656c2f506572736f6e2447656e6465723b4c00046e616d657400124c6a6176612f6c616e672f537472696e673b7870000000417371007e0000000000027704000000027371007e00020000001c7371007e000000000000770400000000787e72001e746f6f6c732e676f6f642e6d6f64656c2e506572736f6e2447656e64657200000000000000001200007872000e6a6176612e6c616e672e456e756d000000000000000012000078707400044d414c457400054f73616d617371007e00020000001e7371007e0000000000007704000000007871007e000c740008416264756c6c61687871007e000c7400064b68616c69647371007e0002000000327371007e0000000000017704000000017371007e000200000019707e71007e000a74000646454d414c4574000548617269737871007e000c740005417a66617278',
  'hex',
)

interface DeserializedObject {
  objects: Content[]
  classes: ClassDescription[]
}

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

const editorOptions = { readOnly: true, wordWrap: 'on', contextmenu: false } as const

type View = 'data' | 'tree' | 'classes'

function JavaDeserializer() {
  const [encoded, setEncoded] = useToolState('java:hex', '')
  const [buffer, setBuffer] = useToolState<Buffer | null>('java:buffer', null)
  const [inputError, setInputError] = useState('')
  const [connect, setConnect] = useToolState('java:connect', true)
  const [view, setView] = useToolState<View>('java:view', 'data')

  // Re-runs when "Connect classes" is toggled.
  const result = useMemo((): { decoded?: DeserializedObject; error?: string } => {
    if (!buffer) return {}
    try {
      return { decoded: deserialize(buffer, connect) }
    } catch (e) {
      return { error: errorMessage(e, 'Deserialization failed') }
    }
  }, [buffer, connect])
  const { decoded } = result
  const treeState = useJsonTree(decoded?.objects)

  const classes = useMemo(() => {
    if (!decoded) return ''
    try {
      return print(decoded.classes)
    } catch (e) {
      return `// failed to dump classes: ${errorMessage(e, 'unknown error')}`
    }
  }, [decoded])

  const data = useMemo(() => {
    if (!decoded) return ''
    try {
      return JSON.stringify(normalize(decoded.objects), null, 2)
    } catch (e) {
      return `// failed to dump data: ${errorMessage(e, 'unknown error')}`
    }
  }, [decoded])

  const reset = (value: string) => {
    setEncoded(value)
    setBuffer(null)
    setInputError('')
  }

  const deserializeObject = () => {
    reset(encoded)
    try {
      setBuffer(parseHex(encoded))
    } catch (e) {
      setInputError(errorMessage(e, 'Invalid hex'))
    }
  }

  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    void f.arrayBuffer().then((ab) => reset(Buffer.from(ab).toString('hex')))
  }

  const text = view === 'classes' ? classes : data

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={deserializeObject} disabled={!encoded.trim()} title='Decode (Ctrl+Enter)'>
            <Play /> Decode
          </Button>
          <Button size='sm' variant='ghost' onClick={() => reset(EXAMPLE_OBJECT.toString('hex'))}>
            <FlaskConical /> Load example
          </Button>
          <FileButton size='sm' variant='ghost' onFileSelected={loadFile}>
            <FileUp /> Load file
          </FileButton>
          <Button size='sm' variant='ghost' onClick={() => reset('')} disabled={!encoded}>
            <Eraser /> Clear
          </Button>
          <div className='ml-auto flex items-center gap-3'>
            <Checkbox checked={connect} onChange={(e) => setConnect(e.target.checked)} title='Connect classes' />
            <Segmented<View>
              label='Output view'
              value={view}
              onChange={setView}
              options={[
                ['data', 'Data'],
                ['tree', 'Tree'],
                ['classes', 'Classes'],
              ]}
            />
          </div>
        </>
      }
    >
      <Alert>{inputError || result.error}</Alert>
      <Split>
        <Panel title='Serialized object (hex)'>
          <Textarea
            autoFocus
            aria-label='Serialized object (hex)'
            className={paneField}
            value={encoded}
            onCtrlEnter={deserializeObject}
            onChange={(e) => setEncoded(e.target.value)}
            placeholder='aced0005737200...'
          />
        </Panel>
        <Panel
          title={view === 'data' ? 'Normalized data' : view === 'tree' ? 'Object tree' : 'Dumped classes'}
          actions={view !== 'tree' && <CopyButton value={text} disabled={!text} />}
        >
          {!decoded ? (
            <p className='p-2.5 text-xs text-muted-foreground'>Press Decode to deserialize</p>
          ) : view === 'tree' ? (
            <JsonTree value={decoded.objects} state={treeState} />
          ) : (
            <CodeEditor value={text} language={view === 'classes' ? 'java' : 'json'} options={editorOptions} />
          )}
        </Panel>
      </Split>
    </Workspace>
  )
}

export default JavaDeserializer
