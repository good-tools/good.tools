import { Slot } from '@radix-ui/react-slot'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/85',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
  link: 'text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground px-0! h-auto!',
}

const sizes = {
  sm: 'h-7 gap-1.5 px-2 text-xs [&_svg]:size-3.5',
  default: 'h-8 gap-1.5 px-3 text-[13px]',
  lg: 'h-9 gap-2 px-4 text-sm',
  icon: 'size-8',
  'icon-sm': 'size-7 [&_svg]:size-3.5',
}

export type ButtonVariant = keyof typeof variants
export type ButtonSize = keyof typeof sizes

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Render the child element (e.g. a Link) with button styles */
  asChild?: boolean
}

export function buttonClass(variant: ButtonVariant = 'default', size: ButtonSize = 'default', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    variants[variant],
    sizes[size],
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp ref={ref} className={buttonClass(variant, size, className)} {...(asChild ? {} : { type })} {...props} />
    )
  },
)
Button.displayName = 'Button'
