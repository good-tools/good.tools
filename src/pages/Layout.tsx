import { Outlet, useLocation } from 'react-router-dom'
import SimpleHeader from '@/components/SimpleHeader'
import { Sidebar } from '@/components/Sidebar'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { cn } from '@/lib/utils'
import packageJson from '../../package.json'

function Footer() {
  const { fullWidthMode } = useLayoutStore()

  return (
    <footer className='border-t border-border bg-muted/30 mt-auto'>
      <div className={cn('px-4 py-3', !fullWidthMode && 'max-w-7xl mx-auto')}>
        <p className='text-center text-xs text-muted-foreground'>
          v{packageJson.version} © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}

export function Layout() {
  const location = useLocation()
  const { fullWidthMode } = useLayoutStore()
  const isHomePage = location.pathname === '/'

  return (
    <div className='h-screen bg-background flex flex-col overflow-hidden'>
      <SimpleHeader />
      <div className={cn('flex flex-1 overflow-hidden', !fullWidthMode && !isHomePage && 'max-w-7xl mx-auto w-full')}>
        {!isHomePage && <Sidebar />}
        <div className='flex-1 flex flex-col overflow-hidden'>
          <main className='flex-1 overflow-auto'>
            <Outlet />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}
