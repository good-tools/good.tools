import { type ChangeEvent, useRef } from 'react'
import { Button, type ButtonProps } from './button'

export interface FileButtonProps extends Omit<ButtonProps, 'onClick' | 'asChild'> {
  onFileSelected: (e: ChangeEvent<HTMLInputElement>) => void
  accept?: string
}

export function FileButton({ onFileSelected, accept, children, ...props }: FileButtonProps) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        className='hidden'
        type='file'
        accept={accept}
        onChange={(e) => {
          onFileSelected(e)
          e.target.value = '' // allow re-selecting the same file
        }}
      />
      <Button variant='outline' {...props} onClick={() => input.current?.click()}>
        {children}
      </Button>
    </>
  )
}
