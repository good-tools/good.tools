import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { CornerDownLeft, Search } from 'lucide-react'
import { availableTools } from '@/config/tools.config'
import { searchTools } from '@/lib/categories'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { Badge } from '@/components/ui/badge'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

/** Global ⌘K / Ctrl+K / "/" tool switcher. Mounted once in Layout. */
export function CommandPalette() {
  const open = useLayoutStore((s) => s.paletteOpen)
  const setOpen = useLayoutStore((s) => s.setPaletteOpen)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => searchTools(availableTools, query), [query])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const typing =
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor')
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function close() {
    setOpen(false)
    setQuery('')
  }

  function go(index: number) {
    const tool = results[index]
    if (!tool) return
    close()
    void navigate(tool.path)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(active)
    }
  }

  return (
    <Dialog open={open} onClose={close} className='relative z-50'>
      <DialogBackdrop
        transition
        className='fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 data-closed:opacity-0'
      />
      <div className='fixed inset-0 flex items-start justify-center p-4 pt-[12vh]'>
        <DialogPanel
          transition
          className='w-full max-w-lg overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl transition duration-150 data-closed:scale-[0.98] data-closed:opacity-0'
        >
          <DialogTitle className='sr-only'>Search tools</DialogTitle>
          <div className='flex items-center gap-2 border-b px-3'>
            <Search className='size-4 shrink-0 text-muted-foreground' />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder='Search tools…'
              aria-label='Search tools'
              role='combobox'
              aria-expanded
              aria-controls='palette-results'
              aria-activedescendant={results[active] ? `palette-${results[active].path}` : undefined}
              className='h-10 w-full border-0 bg-transparent px-0 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-0'
            />
            <Kbd>Esc</Kbd>
          </div>
          {results.length === 0 ? (
            <p className='px-4 py-8 text-center text-muted-foreground'>
              No tools match <span className='font-medium text-foreground'>“{query}”</span>
            </p>
          ) : (
            <ul
              ref={listRef}
              id='palette-results'
              role='listbox'
              className='max-h-[min(60vh,420px)] overflow-y-auto p-1.5'
            >
              {results.map((tool, i) => {
                const Icon = tool.icon
                return (
                  <li
                    key={tool.path}
                    id={`palette-${tool.path}`}
                    role='option'
                    aria-selected={i === active}
                    data-active={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(i)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5',
                      i === active && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <Icon className='size-4 shrink-0 text-muted-foreground' />
                    <span className='min-w-0 flex-1'>
                      <span className='flex items-center gap-2 font-medium'>
                        {tool.title}
                        {tool.online && <Badge variant='warning'>online</Badge>}
                      </span>
                      <span className='block truncate text-xs text-muted-foreground'>{tool.description}</span>
                    </span>
                    {i === active && <CornerDownLeft className='size-4 shrink-0 text-muted-foreground' />}
                  </li>
                )
              })}
            </ul>
          )}
          <div className='flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground'>
            <span className='flex items-center gap-1'>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className='flex items-center gap-1'>
              <Kbd>↵</Kbd> open
            </span>
            <span className='ml-auto'>{results.length} tools</span>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
