import { Upload } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  /** Main text; defaults to "Drop a file here or click to browse" */
  children?: ReactNode
  hint?: ReactNode
}

/** Keyboard-accessible file drop target (also opens the file picker on click / Enter / Space). */
export function DropZone({ onFiles, accept, multiple, disabled, className, children, hint }: DropZoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <label
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          input.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (disabled) return
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onFiles(multiple ? files : files.slice(0, 1))
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors',
        'focus-visible:border-ring focus-visible:outline-none',
        over ? 'border-foreground/50 bg-accent' : 'hover:border-muted-foreground/40 hover:bg-muted/40',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <Upload className='size-5 text-muted-foreground' />
      <span className='text-[13px] font-medium'>{children ?? 'Drop a file here or click to browse'}</span>
      {hint && <span className='text-xs text-muted-foreground'>{hint}</span>}
      <input
        ref={input}
        type='file'
        className='sr-only'
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </label>
  )
}

/**
 * Accepts files dropped anywhere on its children, e.g. a tool whose DropZone is gone once files are loaded.
 * Ignores drags that carry no files (like reordering rows).
 */
export function DropTarget({
  onFiles,
  label = 'Drop to add',
  className,
  children,
}: {
  onFiles: (files: File[]) => void
  label?: string
  className?: string
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop-only convenience; every tool also has a file button
    <div
      className={cn('relative', className)}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onFiles(files)
      }}
    >
      {children}
      {over && (
        <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-foreground/50 bg-background/80 text-[13px] font-medium'>
          {label}
        </div>
      )}
    </div>
  )
}
