import { Download, FileText, Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { downloadBlob } from '@/lib/utils'

/** Loosely typed MCP content block (tool results, prompt messages) or resource contents entry. */
export interface Block {
  type?: string
  text?: string
  data?: string
  blob?: string
  mimeType?: string
  uri?: string
  name?: string
  title?: string
  description?: string
  resource?: Block
}

/** Pretty-prints text that is JSON; leaves everything else alone. */
export function prettyText(text: string): { text: string; json: boolean } {
  const t = text.trim()
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      return { text: JSON.stringify(JSON.parse(t), null, 2), json: true }
    } catch {
      // not JSON after all
    }
  }
  return { text, json: false }
}

const base64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

function BlockHeader({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className='flex min-h-7 items-center gap-2 border-b bg-muted/40 py-0.5 pr-1 pl-2.5 text-[11px] text-muted-foreground'>
      <div className='flex min-w-0 flex-1 items-center gap-1.5 truncate'>{children}</div>
      {actions}
    </div>
  )
}

function TextBlock({ text, label, mimeType }: { text: string; label: string; mimeType?: string }) {
  const pretty = prettyText(text)
  return (
    <div className='overflow-hidden rounded-md border'>
      <BlockHeader actions={<CopyButton size='icon-sm' label={`Copy ${label}`} value={pretty.text} />}>
        {label}
        {(mimeType || pretty.json) && <Badge variant='outline'>{mimeType ?? 'json'}</Badge>}
        <span>{text.length.toLocaleString()} chars</span>
      </BlockHeader>
      <pre className='max-h-[60vh] overflow-auto p-2.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap'>
        {pretty.text}
      </pre>
    </div>
  )
}

function BinaryBlock({
  data,
  mimeType = 'application/octet-stream',
  label,
  uri,
}: {
  data: string
  mimeType?: string
  label: string
  uri?: string
}) {
  const src = `data:${mimeType};base64,${data}`
  const filename = uri?.split('/').pop() || `${label}.${mimeType.split('/')[1] ?? 'bin'}`
  return (
    <div className='overflow-hidden rounded-md border'>
      <BlockHeader
        actions={
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={`Download ${label}`}
            onClick={() => downloadBlob(base64ToBytes(data), filename, mimeType)}
          >
            <Download />
          </Button>
        }
      >
        {label}
        <Badge variant='outline'>{mimeType}</Badge>
        <span>{Math.round((data.length * 3) / 4).toLocaleString()} bytes</span>
      </BlockHeader>
      <div className='flex justify-center bg-muted/20 p-2'>
        {mimeType.startsWith('image/') ? (
          <img src={src} alt={label} className='max-h-96 max-w-full object-contain' />
        ) : mimeType.startsWith('audio/') ? (
          // biome-ignore lint/a11y/useMediaCaption: arbitrary audio returned by a server
          <audio controls src={src} className='w-full' />
        ) : (
          <span className='py-4 text-xs text-muted-foreground'>Binary content — download to inspect</span>
        )}
      </div>
    </div>
  )
}

export function ContentBlock({ block, index }: { block: Block; index: number }) {
  const label = `#${index + 1}`
  switch (block.type) {
    case 'text':
      return <TextBlock text={block.text ?? ''} label={`${label} text`} />
    case 'image':
    case 'audio':
      return <BinaryBlock data={block.data ?? ''} mimeType={block.mimeType} label={`${label} ${block.type}`} />
    case 'resource':
      return block.resource ? <ResourceContents contents={block.resource} label={`${label} resource`} /> : null
    case 'resource_link':
      return (
        <div className='flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs'>
          <Link2 className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
          <div className='min-w-0'>
            <div className='font-medium'>{block.title ?? block.name ?? block.uri}</div>
            <div className='font-mono break-all text-muted-foreground'>{block.uri}</div>
            {block.description && <div className='mt-0.5 text-muted-foreground'>{block.description}</div>}
          </div>
          {block.mimeType && <Badge variant='outline'>{block.mimeType}</Badge>}
        </div>
      )
    default:
      return <TextBlock text={JSON.stringify(block, null, 2)} label={`${label} ${block.type ?? 'unknown'}`} />
  }
}

/** A `resources/read` contents entry (or an embedded resource). */
export function ResourceContents({ contents, label }: { contents: Block; label: string }) {
  return (
    <div className='flex flex-col gap-1'>
      {contents.uri && (
        <div className='flex items-center gap-1.5 px-0.5 font-mono text-[11px] break-all text-muted-foreground'>
          <FileText className='size-3 shrink-0' />
          {contents.uri}
        </div>
      )}
      {contents.blob !== undefined ? (
        <BinaryBlock data={contents.blob} mimeType={contents.mimeType} label={label} uri={contents.uri} />
      ) : (
        <TextBlock text={contents.text ?? ''} label={label} mimeType={contents.mimeType} />
      )}
    </div>
  )
}
