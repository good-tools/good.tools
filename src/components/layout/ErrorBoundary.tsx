import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GITHUB_URL } from '@/config/app.config'

interface Props {
  children: ReactNode
  /** Tool name, shown in the message; omit for the app-level boundary */
  name?: string
}

/** Catches render errors; the "Try again" button remounts the children. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Error in ${this.props.name ?? 'app'}:`, error, info.componentStack)
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className='mx-auto my-12 max-w-lg rounded-lg border bg-card p-6'>
        <div className='flex items-center gap-2 font-medium'>
          <AlertTriangle className='size-5 text-destructive' />
          {this.props.name ? `${this.props.name} crashed` : 'Something went wrong'}
        </div>
        <pre className='mt-3 max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground'>
          {error.message}
          {import.meta.env.DEV && error.stack ? `\n\n${error.stack}` : ''}
        </pre>
        <div className='mt-4 flex items-center gap-2'>
          <Button size='sm' onClick={() => this.setState({ error: null })}>
            <RotateCcw /> Try again
          </Button>
          <Button size='sm' variant='ghost' asChild>
            <a href={`${GITHUB_URL}/issues/new`} target='_blank' rel='noreferrer'>
              Report a bug
            </a>
          </Button>
        </div>
      </div>
    )
  }
}
