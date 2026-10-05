import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { GITHUB_URL, RELEASE_URL, VERSION } from '@/config/app.config'
import { availableTools } from '@/config/tools.config'
import { groupByCategory } from '@/lib/categories'
import { cn } from '@/lib/utils'
import { useLayoutStore } from '@/stores/useLayoutStore'

const groups = groupByCategory(availableTools)

function NavList({ compact = false }: { compact?: boolean }) {
  return (
    <nav aria-label='Tools' className={cn('flex flex-col gap-3 p-1.5', compact && 'items-center gap-1')}>
      {groups.map(([category, tools]) => (
        <div key={category} className={cn('flex flex-col gap-px', compact && 'items-center')}>
          {!compact && (
            <h2 className='px-2 pt-1 pb-0.5 text-[10.5px] font-medium tracking-wider text-muted-foreground/70 uppercase'>
              {category}
            </h2>
          )}
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <NavLink
                key={tool.path}
                to={tool.path}
                title={compact ? tool.title : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-[5px] text-[13px] transition-colors',
                    compact ? 'size-7 justify-center' : 'h-7 px-2',
                    isActive
                      ? 'bg-accent font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )
                }
              >
                <Icon className='size-3.5 shrink-0' />
                {!compact && <span className='truncate'>{tool.title}</span>}
                {!compact && tool.online && (
                  <span
                    className='ml-auto size-1.5 shrink-0 rounded-full bg-warning'
                    title='Online tool: data is sent to a server'
                  />
                )}
              </NavLink>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

/** `desktop={false}` hides the docked sidebar but keeps the mobile drawer available. */
export function Sidebar({ desktop = true }: { desktop?: boolean }) {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useLayoutStore()
  const { pathname } = useLocation()

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the mobile drawer on every navigation
  useEffect(() => setMobileNavOpen(false), [pathname, setMobileNavOpen])

  return (
    <>
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r bg-muted/40',
          desktop && 'md:flex',
          sidebarCollapsed ? 'w-11' : 'w-52',
        )}
      >
        <div className='flex-1 overflow-y-auto'>
          <NavList compact={sidebarCollapsed} />
        </div>
        <div
          className={cn('flex items-center border-t p-1.5', sidebarCollapsed ? 'justify-center' : 'justify-between')}
        >
          {!sidebarCollapsed && (
            <span className='px-1 text-[11px] text-muted-foreground'>{availableTools.length} tools</span>
          )}
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
      </aside>

      <Dialog open={mobileNavOpen} onClose={setMobileNavOpen} className='relative z-50 md:hidden'>
        <DialogBackdrop transition className='fixed inset-0 bg-black/40 transition-opacity data-closed:opacity-0' />
        <DialogPanel
          transition
          className='fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r bg-background shadow-xl transition-transform duration-200 data-closed:-translate-x-full'
        >
          <div className='flex h-10 items-center justify-between border-b px-3'>
            <span className='text-sm font-semibold'>Tools</span>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => setMobileNavOpen(false)}
              aria-label='Close navigation'
            >
              <X />
            </Button>
          </div>
          <div className='flex-1 overflow-y-auto'>
            <NavList />
          </div>
          <div className='flex justify-between border-t px-4 py-3 text-xs text-muted-foreground'>
            <a href={RELEASE_URL} target='_blank' rel='noreferrer' className='font-mono hover:text-foreground'>
              v{VERSION}
            </a>
            <a href={GITHUB_URL} target='_blank' rel='noreferrer' className='hover:text-foreground'>
              GitHub
            </a>
          </div>
        </DialogPanel>
      </Dialog>
    </>
  )
}
