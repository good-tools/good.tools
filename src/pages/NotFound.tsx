import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 px-4 py-24 text-center'>
      <title>Page not found · good.tools</title>
      <p className='font-mono text-sm text-muted-foreground'>404</p>
      <h1 className='text-xl font-semibold'>This page doesn't exist</h1>
      <p className='text-sm text-muted-foreground'>
        Press <kbd className='font-sans'>/</kbd> to search for a tool, or head back home.
      </p>
      <Button asChild variant='outline' className='mt-2'>
        <Link to='/'>Back to all tools</Link>
      </Button>
    </div>
  )
}
