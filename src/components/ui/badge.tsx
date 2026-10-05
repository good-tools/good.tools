import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-foreground/5 text-foreground ring-border',
  secondary: 'bg-secondary text-secondary-foreground ring-border',
  outline: 'text-muted-foreground ring-border',
  success: 'bg-success/10 text-success ring-success/25',
  warning: 'bg-warning/10 text-warning ring-warning/30',
  destructive: 'bg-destructive/10 text-destructive ring-destructive/25',
}

export type BadgeVariant = keyof typeof variants

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = 'secondary', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-medium ring-1 ring-inset [&_svg]:size-3',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
