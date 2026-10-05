import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const fieldClass =
  'block w-full rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Called when Enter is pressed */
  onEnter?: () => void
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, onEnter, onKeyDown, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(fieldClass, 'h-8 py-1', className)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') onEnter?.()
      onKeyDown?.(e)
    }}
    {...props}
  />
))
Input.displayName = 'Input'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Called on Ctrl/Cmd+Enter */
  onCtrlEnter?: () => void
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onCtrlEnter, onKeyDown, ...props }, ref) => (
    <textarea
      ref={ref}
      spellCheck={false}
      className={cn(fieldClass, 'py-2 font-mono text-xs leading-relaxed', className)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onCtrlEnter?.()
        onKeyDown?.(e)
      }}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
