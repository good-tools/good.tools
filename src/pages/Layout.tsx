import { Outlet, useLocation } from 'react-router'
import { Header } from '@/components/shell/Header'
import { Sidebar } from '@/components/shell/Sidebar'
import { CommandPalette } from '@/components/shell/CommandPalette'

export function Layout() {
  const isHome = useLocation().pathname === '/'

  return (
    <div className='flex h-dvh flex-col'>
      <Header />
      <div className='flex min-h-0 flex-1'>
        <Sidebar desktop={!isHome} />
        <main className='min-w-0 flex-1 overflow-y-auto'>
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
