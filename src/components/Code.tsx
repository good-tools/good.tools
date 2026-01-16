import { Children, createContext, useContext, useEffect, useRef, useState, ReactNode, ReactElement } from 'react'
import { Tab } from '@headlessui/react'
import { cn } from '@/lib/utils'
import { Tag } from './Tag'

interface CodePanelProps {
  title?: string
  tag?: string
  label?: string
  code?: string
}

function getPanelTitle({ title }: CodePanelProps): string {
  return title ?? 'Code'
}

function ClipboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 0 20 20' aria-hidden='true' {...props}>
      <path
        strokeWidth='0'
        d='M5.5 13.5v-5a2 2 0 0 1 2-2l.447-.894A2 2 0 0 1 9.737 4.5h.527a2 2 0 0 1 1.789 1.106l.447.894a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z'
      />
      <path
        fill='none'
        strokeLinejoin='round'
        d='M12.5 6.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2m5 0-.447-.894a2 2 0 0 0-1.79-1.106h-.527a2 2 0 0 0-1.789 1.106L7.5 6.5m5 0-1 1h-3l-1-1'
      />
    </svg>
  )
}

export function CopyButton({ code }: { code: string }) {
  const [copyCount, setCopyCount] = useState(0)
  const copied = copyCount > 0

  useEffect(() => {
    if (copyCount > 0) {
      const timeout = setTimeout(() => setCopyCount(0), 1000)
      return () => {
        clearTimeout(timeout)
      }
    }
    return undefined
  }, [copyCount])

  return (
    <button
      type='button'
      className={cn(
        'group/button absolute top-3.5 right-4 overflow-hidden rounded-full py-1 pl-2 pr-3 text-2xs font-medium opacity-0 backdrop-blur transition focus:opacity-100 group-hover:opacity-100',
        copied
          ? 'bg-blue-400/10 ring-1 ring-inset ring-blue-400/20'
          : 'bg-white/5 hover:bg-white/7.5 dark:bg-white/2.5 dark:hover:bg-white/5',
      )}
      onClick={() => {
        void window.navigator.clipboard.writeText(code).then(() => {
          setCopyCount((count) => count + 1)
        })
      }}
    >
      <span
        aria-hidden={copied}
        className={cn(
          'pointer-events-none flex items-center gap-0.5 text-zinc-400 transition duration-300',
          copied && '-translate-y-1.5 opacity-0',
        )}
      >
        <ClipboardIcon className='h-5 w-5 fill-zinc-500/20 stroke-zinc-500 transition-colors group-hover/button:stroke-zinc-400' />
        Copy
      </span>
      <span
        aria-hidden={!copied}
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center text-blue-400 transition duration-300',
          !copied && 'translate-y-1.5 opacity-0',
        )}
      >
        Copied!
      </span>
    </button>
  )
}

function CodePanelHeader({ tag, label }: { tag?: string; label?: string }) {
  if (!tag && !label) {
    return null
  }

  return (
    <div className='flex h-9 items-center gap-2 border-y border-t-transparent border-b-white/7.5 bg-zinc-900 bg-white/2.5 px-4 dark:border-b-white/5 dark:bg-white/1'>
      {tag && (
        <div className='dark flex'>
          <Tag variant='small'>{tag}</Tag>
        </div>
      )}
      {tag && label && <span className='h-0.5 w-0.5 rounded-full bg-zinc-500' />}
      {label && <span className='font-mono text-xs text-zinc-400'>{label}</span>}
    </div>
  )
}

interface CodePanelPropsMain extends CodePanelProps {
  children: ReactElement
}

function CodePanel({ tag, label, code, children }: CodePanelPropsMain) {
  const child = Children.only(children) as ReactElement<CodePanelProps>

  return (
    <div className='group dark:bg-white/2.5'>
      <CodePanelHeader tag={child.props.tag ?? tag} label={child.props.label ?? label} />
      <div className='relative'>
        <pre className='whitespace-pre-line break-all p-4 text-xs text-white'>{children}</pre>
        <CopyButton code={child.props.code ?? code ?? ''} />
      </div>
    </div>
  )
}

function CodeGroupHeader({
  title,
  children,
  selectedIndex,
}: {
  title?: string
  children: ReactNode
  selectedIndex?: number
}) {
  const hasTabs = Children.count(children) > 1

  if (!title && !hasTabs) {
    return null
  }

  return (
    <div className='flex min-h-[calc(theme(spacing.12)+1px)] flex-wrap items-start gap-x-4 border-b border-zinc-700 bg-zinc-800 px-4 dark:border-zinc-800 dark:bg-transparent'>
      {title && <h3 className='mr-auto pt-3 text-xs font-semibold text-white'>{title}</h3>}
      {hasTabs && (
        <Tab.List className='-mb-px flex gap-4 text-xs font-medium'>
          {Children.map(children, (child, childIndex) => (
            <Tab
              className={cn(
                'border-b py-3 transition focus:[&:not(:focus-visible)]:outline-none',
                childIndex === selectedIndex
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300',
              )}
            >
              {getPanelTitle((child as ReactElement<CodePanelProps>).props)}
            </Tab>
          ))}
        </Tab.List>
      )}
    </div>
  )
}

function CodeGroupPanels({ children, ...props }: CodePanelProps & { children: ReactNode }) {
  const hasTabs = Children.count(children) > 1

  if (hasTabs) {
    return (
      <Tab.Panels>
        {Children.map(children, (child) => (
          <Tab.Panel>
            <CodePanel {...props}>{child as ReactElement}</CodePanel>
          </Tab.Panel>
        ))}
      </Tab.Panels>
    )
  }

  return <CodePanel {...props}>{children as ReactElement}</CodePanel>
}

function usePreventLayoutShift() {
  const positionRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return {
    positionRef,
    preventLayoutShift: (callback: () => void) => {
      if (!positionRef.current) return

      const initialTop = positionRef.current.getBoundingClientRect().top

      callback()

      rafRef.current = window.requestAnimationFrame(() => {
        if (!positionRef.current) return
        const newTop = positionRef.current.getBoundingClientRect().top
        window.scrollBy(0, newTop - initialTop)
      })
    },
  }
}

function useTabGroupProps(_availableLanguages: string[]) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { positionRef, preventLayoutShift } = usePreventLayoutShift()

  return {
    as: 'div' as const,
    ref: positionRef,
    selectedIndex,
    onChange: (newSelectedIndex: number) => {
      preventLayoutShift(() => {
        setSelectedIndex(newSelectedIndex)
      })
    },
  }
}

const CodeGroupContext = createContext(false)

export function CodeGroup({ children, title, ...props }: CodePanelProps & { children: ReactNode }) {
  const languages =
    Children.map(children, (child) => getPanelTitle((child as ReactElement<CodePanelProps>).props)) ?? []
  const tabGroupProps = useTabGroupProps(languages)
  const hasTabs = Children.count(children) > 1
  const Container = hasTabs ? Tab.Group : 'div'
  const containerProps = hasTabs ? tabGroupProps : {}
  const headerProps = hasTabs ? { selectedIndex: tabGroupProps.selectedIndex } : {}

  return (
    <CodeGroupContext.Provider value={true}>
      <Container
        {...containerProps}
        className='not-prose my-6 overflow-hidden rounded-2xl bg-zinc-900 shadow-md dark:ring-1 dark:ring-white/10'
      >
        <CodeGroupHeader title={title} {...headerProps}>
          {children}
        </CodeGroupHeader>
        <CodeGroupPanels {...props}>{children}</CodeGroupPanels>
      </Container>
    </CodeGroupContext.Provider>
  )
}

export function Code({ children, ...props }: React.HTMLAttributes<HTMLElement>) {
  const isGrouped = useContext(CodeGroupContext)

  if (isGrouped) {
    return <code {...props} dangerouslySetInnerHTML={{ __html: children as string }} />
  }

  return <code {...props}>{children}</code>
}

export function Pre({ children, ...props }: CodePanelProps & { children: ReactNode }) {
  const isGrouped = useContext(CodeGroupContext)

  if (isGrouped) {
    return children
  }

  return <CodeGroup {...props}>{children}</CodeGroup>
}
