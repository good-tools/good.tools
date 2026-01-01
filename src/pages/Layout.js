import { Outlet, useLocation } from 'react-router-dom'
import SimpleHeader from '../components/SimpleHeader'

export function Layout() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900">
      {!isHomePage && <SimpleHeader />}
      <main className="text-zinc-900 dark:text-white">
        <Outlet />
      </main>
    </div>
  )
}
