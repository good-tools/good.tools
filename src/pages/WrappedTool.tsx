import { Suspense, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { AlertTriangle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ToolErrorBoundary } from '@/components/layout/ToolErrorBoundary'
import type { Tool } from '@/types'

interface WrappedToolProps {
  tool: Tool
}

function WrappedTool({ tool }: WrappedToolProps) {
  const [proceed, setProceed] = useState(false)

  return (
    <>
      <Helmet>
        <title>good.tools · {tool.title}</title>
        <meta name='description' content={tool.description} />
        <meta name='keywords' content={tool.searchTags.join(',')} />
      </Helmet>

      <div className='p-4 md:p-6'>
        {/* Tool Header */}
        <div className='mb-6'>
          <h1 className='text-2xl md:text-3xl font-semibold mb-2 text-foreground'>{tool.title}</h1>
          <p className='text-sm text-muted-foreground'>{tool.description}</p>
        </div>

        {tool.warning && !proceed ? (
          <Card className='border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'>
            <CardHeader className='pb-3'>
              <div className='flex items-center gap-2 text-amber-700 dark:text-amber-400'>
                <AlertTriangle className='w-5 h-5' />
                <CardTitle className='text-lg'>Warning</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className='text-foreground mb-4'>
                <tool.warning />
              </div>
              <p className='text-muted-foreground mb-4 text-sm'>Proceed at your own risk.</p>
              <Button onClick={() => setProceed(true)} size='sm'>
                Continue
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className='p-4 md:p-6'>
              <ToolErrorBoundary toolName={tool.title}>
                <Suspense
                  fallback={
                    <div className='flex items-center justify-center py-16'>
                      <div className='text-muted-foreground text-sm'>Loading...</div>
                    </div>
                  }
                >
                  <tool.component />
                </Suspense>
              </ToolErrorBoundary>
            </CardContent>
          </Card>
        )}

        {typeof tool.dependencies !== 'undefined' && (
          <Card className='mt-4'>
            <CardContent className='p-4'>
              {tool.online && (
                <div className='text-xs flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-400'>
                  <AlertTriangle className='w-3.5 h-3.5 flex-shrink-0' />
                  <span>This is an online tool, the data you submit gets processed on a remote server.</span>
                </div>
              )}
              <div className='text-xs text-muted-foreground'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <Zap className='w-3.5 h-3.5 flex-shrink-0' />
                  <span>Built using</span>
                  {tool.dependencies.map((d, i) => (
                    <Badge
                      key={`tag-${i}`}
                      variant='secondary'
                      className='cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs'
                    >
                      {d.url ? (
                        <a href={d.url} target='_blank' rel='noopener noreferrer'>
                          {d.name}
                        </a>
                      ) : (
                        d.name
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

export default WrappedTool
