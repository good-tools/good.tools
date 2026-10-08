import { type ComponentProps, useId } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'title'> {
  title?: string
  description?: string
}

export function Checkbox({ className, title, description, id, ...props }: CheckboxProps) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  return (
    <label
      htmlFor={inputId}
      title={description}
      className={cn('inline-flex items-center gap-1.5 text-[13px]', className)}
    >
      <input
        id={inputId}
        type='checkbox'
        className='size-3.5 cursor-pointer appearance-auto accent-foreground'
        {...props}
      />
      {title && <span className='text-foreground/90 select-none'>{title}</span>}
    </label>
  )
}
