import type { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // biome-ignore lint/a11y/noLabelWithoutControl: generic Label; callers pass htmlFor
  return <label className={cn('text-xs font-medium text-muted-foreground', className)} {...props} />
}
