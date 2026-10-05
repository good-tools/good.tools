import type { HTMLAttributes } from 'react'
import { AlertTriangle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const variants = {
  error: { className: 'border-destructive/30 bg-destructive/10 text-destructive', icon: XCircle },
  warning: { className: 'border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning', icon: AlertTriangle },
  info: { className: 'border-border bg-muted/50 text-foreground [&>svg]:text-muted-foreground', icon: Info },
}

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants
}

/** Inline message box. Renders nothing when it has no children. */
export function Alert({ variant = 'error', className, children, ...props }: AlertProps) {
  if (children == null || children === '' || children === false) return null
  const { className: v, icon: Icon } = variants[variant]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[13px]', v, className)}
      {...props}
    >
      <Icon className='mt-0.5 size-4 shrink-0' />
      <div className='min-w-0 break-words'>{children}</div>
    </div>
  )
}
