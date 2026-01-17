import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

function NotFound() {
  return (
    <>
      <Helmet>
        <title>404 - Page Not Found · good.tools</title>
      </Helmet>
      <div className='min-h-screen bg-background flex items-center justify-center px-4'>
        <div className='text-center animate-in'>
          <h1 className='text-6xl md:text-8xl font-bold gradient-text mb-4'>404</h1>
          <p className='text-xl md:text-2xl text-muted-foreground mb-8'>
            Oops! The page you're looking for doesn't exist.
          </p>
          <Button asChild size='lg'>
            <Link to='/'>
              <Home className='w-5 h-5 mr-2' />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </>
  )
}

export default NotFound
