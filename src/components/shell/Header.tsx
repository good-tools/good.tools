import { Menu, Search } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { GITHUB_URL, RELEASE_URL, VERSION } from '@/config/app.config'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { GitHubIcon, LogoMark } from './icons'
import { ThemeToggle } from './ThemeToggle'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

export function Header() {
  const setPaletteOpen = useLayoutStore((s) => s.setPaletteOpen)
  const setMobileNavOpen = useLayoutStore((s) => s.setMobileNavOpen)

  return (
    <header className='sticky top-0 z-40 flex h-10 shrink-0 items-center gap-2 border-b bg-background px-2.5'>
      <Button
        variant='ghost'
        size='icon-sm'
        className='md:hidden'
        onClick={() => setMobileNavOpen(true)}
        aria-label='Open navigation'
      >
        <Menu />
      </Button>

      <Link to='/' className='flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] font-semibold tracking-tight'>
        <LogoMark className='size-5' />
        <span>
          good<span className='text-muted-foreground'>.tools</span>
        </span>
      </Link>

      <button
        type='button'
        onClick={() => setPaletteOpen(true)}
        className='ml-2 flex h-7 w-full max-w-64 items-center gap-2 rounded-md border bg-muted/60 px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-sm:max-w-none max-sm:flex-1 sm:ml-4'
      >
        <Search className='size-3.5' />
        <span className='flex-1 text-left'>Search tools…</span>
        <span className='hidden items-center gap-0.5 sm:flex'>
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className='ml-auto flex items-center gap-1'>
        <a
          href={RELEASE_URL}
          target='_blank'
          rel='noreferrer'
          className='hidden rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:block'
          title='Release notes'
        >
          v{VERSION}
        </a>
        <Button variant='ghost' size='icon-sm' asChild>
          <a href={GITHUB_URL} target='_blank' rel='noreferrer' aria-label='Source on GitHub' title='Source on GitHub'>
            <GitHubIcon />
          </a>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  )
}
