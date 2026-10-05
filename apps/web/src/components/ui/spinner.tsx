import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role='status' className='inline-flex items-center gap-2 text-sm text-muted-foreground'>
      <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden='true' />
      {label ?? <span className='sr-only'>Loading</span>}
    </span>
  )
}
