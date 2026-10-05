import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, type ButtonProps } from './button'

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'value'> {
  /** Text to copy (or a function producing it) */
  value: string | (() => string)
  label?: string
}

export function CopyButton({ value, label = 'Copy', variant = 'ghost', size = 'sm', ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(typeof value === 'function' ? value() : value).then(() => setCopied(true))
      }}
      {...props}
    >
      {copied ? <Check className='text-success' /> : <Copy />}
      {size !== 'icon' && size !== 'icon-sm' && (copied ? 'Copied' : label)}
    </Button>
  )
}
