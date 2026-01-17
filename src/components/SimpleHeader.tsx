import { Link } from 'react-router-dom'
import { Wrench, Maximize2, Minimize2 } from 'lucide-react'
import { ModeToggle } from './ModeToggle'
import { Search, MobileSearch } from './Search'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { cn } from '@/lib/utils'

function SimpleHeader() {
  const { fullWidthMode, toggleFullWidth } = useLayoutStore()
  return (
    <header className='sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border'>
      <div className={cn('flex h-14 items-center justify-between gap-4 px-4', !fullWidthMode && 'max-w-7xl mx-auto')}>
        <Link to='/' className='flex items-center gap-3 hover:opacity-80 transition-opacity'>
          {/* Icon Box */}
          <div className='h-8 w-8 rounded bg-primary flex items-center justify-center'>
            <Wrench className='h-4 w-4 text-primary-foreground' />
          </div>

          {/* Brand Text with Gradient */}
          <span className='text-lg font-semibold'>
            good<span className='gradient-text'>.tools</span>
          </span>
        </Link>

        <div className='flex items-center gap-1'>
          <Search />
          <MobileSearch />
          <button
            onClick={toggleFullWidth}
            className='p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors rounded'
            title={fullWidthMode ? 'Constrained width' : 'Full width'}
          >
            {fullWidthMode ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}
          </button>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}

export default SimpleHeader
