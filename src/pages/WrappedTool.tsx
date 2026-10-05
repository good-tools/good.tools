import { Cloud, HardDrive, Info } from 'lucide-react'
import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useToolState } from '@/hooks/useToolState'
import type { Tool } from '@/types/tool.types'

export default function WrappedTool({ tool }: { tool: Tool }) {
  const [accepted, setAccepted] = useToolState(`notice:${tool.path}`, false)
  const Icon = tool.icon
  const builtWith = tool.dependencies?.map((d) => d.name).join(', ')

  return (
    <div className='flex min-h-full flex-col'>
      <title>{`${tool.title} · good.tools`}</title>
      <meta name='description' content={tool.description} />
      <meta name='keywords' content={tool.searchTags.join(',')} />

      <div className='flex h-10 shrink-0 items-center gap-2 border-b px-3'>
        <Icon className='size-4 shrink-0 text-muted-foreground' />
        <h1 className='shrink-0 text-[13px] font-semibold'>{tool.title}</h1>
        <p className='hidden min-w-0 truncate text-xs text-muted-foreground md:block' title={tool.description}>
          {tool.description}
        </p>
        <div className='ml-auto flex shrink-0 items-center gap-2'>
          {tool.dependencies && (
            <span className='hidden text-[11px] text-muted-foreground xl:inline' title={`Built with ${builtWith}`}>
              {tool.dependencies.map((d, i) => (
                <span key={d.name}>
                  {i > 0 && ', '}
                  {d.url ? (
                    <a href={d.url} target='_blank' rel='noreferrer' className='font-mono hover:text-foreground'>
                      {d.name}
                    </a>
                  ) : (
                    <span className='font-mono'>{d.name}</span>
                  )}
                </span>
              ))}
            </span>
          )}
          {tool.online ? (
            <Badge variant='warning' title='Input you submit is processed on a remote server'>
              <Cloud /> Online
            </Badge>
          ) : (
            <Badge variant='outline' title='Runs entirely in your browser; nothing is uploaded'>
              <HardDrive /> Local
            </Badge>
          )}
        </div>
      </div>

      <div className='flex-1 p-3'>
        {tool.notice && !accepted ? (
          <div className='mx-auto mt-6 flex max-w-md gap-2.5 rounded-md border bg-card p-3'>
            <Info className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
            <div>
              <p>{tool.notice}</p>
              <Button className='mt-3' size='sm' onClick={() => setAccepted(true)}>
                Load {tool.title}
              </Button>
            </div>
          </div>
        ) : (
          <ErrorBoundary name={tool.title} key={tool.path}>
            <Suspense
              fallback={
                <div className='flex justify-center py-20'>
                  <Spinner label='Loading tool…' />
                </div>
              }
            >
              <tool.component />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
