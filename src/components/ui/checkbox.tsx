import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'title'> {
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
        className='size-3.5 rounded-sm border-input text-primary dark:bg-background dark:checked:bg-primary focus:ring-ring/40 focus:ring-offset-0'
        {...props}
      />
      {title && <span className='text-foreground/90 select-none'>{title}</span>}
    </label>
  )
}
