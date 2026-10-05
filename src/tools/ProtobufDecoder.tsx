import { useMemo } from 'react'
import { useToolState } from '@/hooks/useToolState'
import { Buffer } from 'buffer'
import { decode, typeDefinition, possibleValues, type DecodingResult } from '@goodtools/protobuf-decoder'
import { Eraser, FileUp, FlaskConical } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FileButton } from '@/components/ui/file-button'
import { Textarea } from '@/components/ui/input'
import { Panel, Split, Workspace, paneField } from '@/components/ui/toolbar'
import { parseHex } from '@/lib/hex'

const EXAMPLE_PROTOBUF = Buffer.from([
  0x08, 0x8f, 0x81, 0xeb, 0xcf, 0xe0, 0x2a, 0x12, 0x08, 0x6b, 0x6f, 0x74, 0x6c, 0x69, 0x6e, 0x34, 0x36, 0x3a, 0x05,
  0x00, 0x01, 0x03, 0x04, 0x07, 0x42, 0x00, 0x48, 0xfa, 0x01, 0x55, 0x00, 0x00, 0x48, 0x43, 0x72, 0x0a, 0x0a, 0x08,
  0x50, 0x4f, 0x4b, 0x45, 0x43, 0x4f, 0x49, 0x4e, 0x72, 0x0c, 0x0a, 0x08, 0x53, 0x54, 0x41, 0x52, 0x44, 0x55, 0x53,
  0x54, 0x10, 0x64,
])

function ProtobufObject({ object, showBytes }: { object: DecodingResult; showBytes: boolean }) {
  if (object.fields.length === 0) {
    return <div className='px-2 py-1 text-xs text-muted-foreground'>No fields</div>
  }

  return (
    <table className='w-full text-xs'>
      <thead className='text-[11px] text-muted-foreground'>
        <tr className='border-b'>
          <th scope='col' className='h-7 w-12 px-2 text-left font-medium'>
            Field
          </th>
          <th scope='col' className='h-7 w-28 px-2 text-left font-medium'>
            Type
          </th>
          <th scope='col' className='h-7 px-2 text-left font-medium'>
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        {object.fields.map((f, i) => (
          <tr key={i} className='border-b align-top last:border-b-0'>
            <td className='px-2 py-1 font-mono text-muted-foreground'>{f.field}</td>
            <td className='px-2 py-1'>{typeDefinition(f.type).name}</td>
            <td className={f.object ? 'p-0' : 'px-2 py-1'}>
              {f.object ? (
                <div className='border-l'>
                  <ProtobufObject object={f.value as DecodingResult} showBytes={showBytes} />
                </div>
              ) : (
                <dl className='grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-0.5 break-all'>
                  {possibleValues(f)
                    .filter((p) => showBytes || p.type !== 'bytes')
                    .map((p, j) => (
                      <div key={j} className='contents'>
                        <dt>
                          <Badge variant='outline' className='font-mono'>
                            {p.type}
                          </Badge>
                        </dt>
                        <dd className={p.type === 'bytes' ? 'font-mono text-muted-foreground' : 'font-mono'}>
                          {String(p.value)}
                        </dd>
                      </div>
                    ))}
                </dl>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      {object.unprocessed.length > 0 && (
        <tfoot className='border-t'>
          <tr>
            <td colSpan={2} className='px-2 py-1 text-muted-foreground'>
              Unprocessed
            </td>
            <td className='px-2 py-1 font-mono break-all'>{object.unprocessed.toString('hex')}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

function ProtobufDecoder() {
  const [encoded, setEncoded] = useToolState('protobuf:hex', '')
  const [showBytes, setShowBytes] = useToolState('protobuf:showBytes', false)

  const result = useMemo((): { decoded?: DecodingResult; error?: string } => {
    if (!encoded.trim()) return {}
    try {
      return { decoded: decode(parseHex(encoded)) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to decode protobuf' }
    }
  }, [encoded])

  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void f.arrayBuffer().then((ab) => setEncoded(Buffer.from(ab).toString('hex')))
  }

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' variant='ghost' onClick={() => setEncoded(EXAMPLE_PROTOBUF.toString('hex'))}>
            <FlaskConical /> Load example
          </Button>
          <FileButton size='sm' variant='ghost' onFileSelected={loadFile}>
            <FileUp /> Load file
          </FileButton>
          <Button size='sm' variant='ghost' onClick={() => setEncoded('')} disabled={!encoded}>
            <Eraser /> Clear
          </Button>
          <Checkbox
            className='ml-auto'
            checked={showBytes}
            onChange={(e) => setShowBytes(e.target.checked)}
            title='Show string bytes'
          />
        </>
      }
    >
      <Alert>{result.error}</Alert>
      <Split>
        <Panel title='Message (hex)'>
          <Textarea
            autoFocus
            aria-label='Protobuf message (hex)'
            className={paneField}
            value={encoded}
            onChange={(e) => setEncoded(e.target.value)}
            placeholder='08 96 01 12 07 74 65 73 74 69 6e 67'
          />
        </Panel>
        <Panel title='Decoded'>
          {result.decoded ? (
            <ProtobufObject object={result.decoded} showBytes={showBytes} />
          ) : (
            <p className='p-2.5 text-xs text-muted-foreground'>Decoded fields appear here as you type</p>
          )}
        </Panel>
      </Split>
    </Workspace>
  )
}

export default ProtobufDecoder
