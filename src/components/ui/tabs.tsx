import { Tab, TabList } from '@headlessui/react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export { TabGroup, TabPanel, TabPanels } from '@headlessui/react'

/** Segmented tab strip; use inside a headlessui <TabGroup>. */
export function Tabs({ className, ...props }: ComponentProps<typeof TabList>) {
  return (
    <TabList
      className={cn('inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5 text-xs', className as string)}
      {...props}
    />
  )
}

export function TabButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Tab
      className={cn(
        'h-full rounded-[5px] px-2.5 font-medium text-muted-foreground transition-colors outline-none',
        'hover:text-foreground data-selected:bg-background data-selected:text-foreground data-selected:shadow-xs',
        'data-focus:ring-2 data-focus:ring-ring',
        className,
      )}
    >
      {children}
    </Tab>
  )
}
