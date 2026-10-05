import { cn } from '@/lib/utils'

/** Compact single-choice toggle (radio group styled as a segmented control). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role='radiogroup'
      aria-label={label}
      className='inline-flex h-7 items-center rounded-md bg-muted p-0.5 text-xs'
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type='button'
          role='radio'
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'h-full rounded-[5px] px-2.5 font-medium text-muted-foreground transition-colors hover:text-foreground',
            value === v && 'bg-background text-foreground shadow-xs',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
