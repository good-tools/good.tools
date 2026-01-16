import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Global Error Boundary component
 * Catches and handles errors in the component tree
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className='flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900'>
          <div className='mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900'>
            <div className='mb-4 flex items-center justify-center'>
              <div className='rounded-full bg-red-100 p-3 dark:bg-red-900/20'>
                <svg
                  className='h-6 w-6 text-red-600 dark:text-red-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                  />
                </svg>
              </div>
            </div>
            <h2 className='mb-2 text-center text-xl font-semibold text-zinc-900 dark:text-white'>
              Something went wrong
            </h2>
            <p className='mb-4 text-center text-sm text-zinc-600 dark:text-zinc-400'>
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            {this.state.error && process.env.NODE_ENV === 'development' && (
              <details className='mt-4 rounded-md bg-zinc-50 p-4 text-xs dark:bg-zinc-800'>
                <summary className='cursor-pointer font-medium text-zinc-700 dark:text-zinc-300'>Error details</summary>
                <pre className='mt-2 overflow-x-auto text-red-600 dark:text-red-400'>{this.state.error.toString()}</pre>
              </details>
            )}
            <div className='mt-6 flex justify-center'>
              <button
                onClick={() => window.location.reload()}
                className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600'
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
