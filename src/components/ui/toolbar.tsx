import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Horizontal row of tool actions (buttons, tabs, toggles). */
export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap items-center gap-1.5', className)} {...props} />
}

/** Titled output/input section inside a tool. */
export function Panel({
  title,
  actions,
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & { title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden rounded-md border bg-card', className)} {...props}>
      {(title || actions) && (
        <header className='flex min-h-8 shrink-0 items-center justify-between gap-2 border-b bg-muted/50 py-0.5 pr-1 pl-2.5'>
          <h2 className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>{title}</h2>
          <div className='flex items-center gap-1'>{actions}</div>
        </header>
      )}
      <div className='min-h-0 flex-1 overflow-auto'>{children}</div>
    </section>
  )
}

/** Full-height tool layout: a toolbar row, then content filling the rest of the viewport. */
export function Workspace({
  toolbar,
  className,
  children,
}: {
  toolbar?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className='flex h-tool flex-col gap-2'>
      {toolbar && <Toolbar className='shrink-0'>{toolbar}</Toolbar>}
      <div className={cn('flex min-h-0 flex-1 flex-col gap-2', className)}>{children}</div>
    </div>
  )
}

/** Two panes side by side on large screens, stacked below that. */
export function Split({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid min-h-0 flex-1 gap-2 max-lg:grid-rows-2 lg:grid-cols-2', className)} {...props} />
}

/** Classes for a borderless textarea that fills a Panel. */
export const paneField =
  'h-full min-h-full w-full resize-none rounded-none border-0 bg-transparent p-2.5 focus:ring-0 focus:border-0'
