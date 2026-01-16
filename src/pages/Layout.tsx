import { Outlet } from 'react-router-dom'
import SimpleHeader from '@/components/SimpleHeader'
import packageJson from '../../package.json'

function Footer() {
  return (
    <footer className='border-t bg-muted/30 mt-auto'>
      <div className='container mx-auto px-4 py-8'>
        <p className='text-center text-sm text-muted-foreground'>
          v{packageJson.version} &copy; {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}

export function Layout() {
  return (
    <div className='min-h-screen bg-background flex flex-col'>
      <SimpleHeader />
      <main className='container mx-auto px-4 py-8 flex-1'>
        <div className='mx-auto max-w-6xl'>
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
