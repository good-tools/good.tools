import { Outlet } from 'react-router'
import { CommandPalette } from '@/components/shell/CommandPalette'
import { Header } from '@/components/shell/Header'
import { Sidebar } from '@/components/shell/Sidebar'

export function Layout() {
  return (
    <div className='flex h-dvh flex-col'>
      <Header />
      <div className='flex min-h-0 flex-1'>
        <Sidebar />
        <main className='min-w-0 flex-1 overflow-y-auto'>
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
