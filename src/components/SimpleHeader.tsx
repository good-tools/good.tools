import { Link } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import { ModeToggle } from './ModeToggle'
import { Search, MobileSearch } from './Search'

function SimpleHeader() {
  return (
    <header className='sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border'>
      <div className='container mx-auto flex h-16 items-center justify-between gap-4 px-4'>
        <Link to='/' className='flex items-center gap-3 hover:opacity-80 transition-opacity'>
          {/* Icon Box */}
          <div className='h-9 w-9 rounded-lg bg-primary flex items-center justify-center'>
            <Wrench className='h-5 w-5 text-primary-foreground' />
          </div>

          {/* Brand Text with Gradient */}
          <span className='text-xl font-semibold'>
            good<span className='gradient-text'>.tools</span>
          </span>
        </Link>

        <div className='flex items-center gap-2'>
          <Search />
          <MobileSearch />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}

export default SimpleHeader
