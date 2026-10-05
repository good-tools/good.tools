import { ChevronDown, ChevronRight, File as FileIcon, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface FileNode {
  name: string
  directory: boolean
  path?: string
  [key: string]: unknown
}

type Load = (node: FileNode) => Promise<FileNode[]>
type Select = (node: FileNode) => Promise<void>

const rowClass =
  'flex h-6 w-full items-center gap-1 rounded-sm px-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const iconClass = 'size-3.5 shrink-0 text-muted-foreground'
const spinner = <Loader2 className={cn(iconClass, 'animate-spin')} aria-label='Loading' />

function File({ node, select }: { node: FileNode; select: Select }) {
  const [loading, setLoading] = useState(false)

  const innerSelect = async () => {
    setLoading(true)
    try {
      await select(node)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type='button' className={rowClass} onClick={() => void innerSelect()}>
      {loading ? spinner : <FileIcon className={iconClass} />}
      <span className='truncate'>{node.name}</span>
    </button>
  )
}

function Directory({ id, node, load, select }: { id: string; node: FileNode; load: Load; select: Select }) {
  const [nodes, setNodes] = useState<FileNode[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const toggle = async () => {
    if (nodes) {
      setOpen(!open)
      return
    }
    setLoading(true)
    try {
      setNodes(await load(node))
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type='button' className={rowClass} aria-expanded={open} onClick={() => void toggle()}>
        {loading ? spinner : open ? <ChevronDown className={iconClass} /> : <ChevronRight className={iconClass} />}
        <span className='truncate'>{node.name}</span>
      </button>
      {open && nodes && nodes.length > 0 && <SubTree id={id} nodes={nodes} load={load} select={select} />}
    </>
  )
}

function SubTree({
  id,
  nodes,
  load,
  select,
  root = false,
}: {
  id: string
  nodes: FileNode[]
  load: Load
  select: Select
  root?: boolean
}) {
  return (
    <ul className={cn('text-xs', root ? 'px-1' : 'ml-2.5 border-l pl-1')}>
      {nodes.map((n, i) => (
        <li key={`${id}-${i}`}>
          {n.directory ? (
            <Directory id={`${id}-${i}`} node={n} load={load} select={select} />
          ) : (
            <File node={n} select={select} />
          )}
        </li>
      ))}
    </ul>
  )
}

interface FileTreeProps {
  load: (node: FileNode | null) => Promise<FileNode[]>
  select: Select
}

function FileTree({ load, select }: FileTreeProps) {
  const [initNodes, setInitNodes] = useState<FileNode[]>([])

  useEffect(() => {
    void load(null).then(setInitNodes)
  }, [load])

  return <SubTree id='root' nodes={initNodes} load={load} select={select} root />
}

export default FileTree
