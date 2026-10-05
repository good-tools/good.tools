import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search, X } from 'lucide-react'
import { availableTools } from '@/config/tools.config'
import { categories, getToolsByCategory, groupByCategory, searchTools, type CategoryName } from '@/lib/categories'
import { cn } from '@/lib/utils'
import type { Tool } from '@/types/tool.types'
import { GITHUB_URL } from '@/config/app.config'

function ToolRow({ tool }: { tool: Tool }) {
  const Icon = tool.icon
  return (
    <Link
      to={tool.path}
      className='group flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none'
    >
      <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground' />
      <span className='min-w-0'>
        <span className='flex items-center gap-1.5 font-medium'>
          {tool.title}
          {tool.online && (
            <span className='size-1.5 rounded-full bg-warning' title='Online: data is sent to a server' />
          )}
        </span>
        <span className='line-clamp-1 text-xs text-muted-foreground' title={tool.description}>
          {tool.description}
        </span>
      </span>
    </Link>
  )
}

export default function Home() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = (params.get('category') ?? 'All') as CategoryName | 'All'

  function update(next: { q?: string; category?: string }) {
    const merged = { q: query, category, ...next }
    const p = new URLSearchParams()
    if (merged.q) p.set('q', merged.q)
    if (merged.category !== 'All') p.set('category', merged.category)
    setParams(p, { replace: true })
  }

  const results = useMemo(() => searchTools(getToolsByCategory(availableTools, category), query), [query, category])
  const filtering = query !== '' || category !== 'All'

  return (
    <div className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10'>
      <title>good.tools · Developer tools that run in your browser</title>
      <meta
        name='description'
        content='Free, fast, privacy-focused developer tools that run entirely in your browser.'
      />

      <h1 className='text-lg font-semibold tracking-tight'>Developer tools that run in your browser</h1>
      <p className='mt-1 text-[13px] text-muted-foreground'>
        Free, fast and private: most tools never send your data anywhere.
      </p>

      <div className='mt-5 flex flex-col gap-2'>
        <div className='relative'>
          <Search className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
          <input
            type='search'
            value={query}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={`Filter ${availableTools.length} tools…`}
            aria-label='Filter tools'
            autoFocus
            className='h-8 w-full rounded-md border border-input bg-background pr-8 pl-8 text-[13px] placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden'
          />
          {query && (
            <button
              type='button'
              onClick={() => update({ q: '' })}
              aria-label='Clear filter'
              className='absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground'
            >
              <X className='size-3.5' />
            </button>
          )}
        </div>
        <div className='flex flex-wrap gap-1' role='group' aria-label='Category'>
          {categories.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type='button'
              aria-pressed={category === name}
              onClick={() => update({ category: name })}
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs transition-colors',
                category === name
                  ? 'border-foreground bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className='size-3' />
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className='mt-6'>
        {results.length === 0 ? (
          <div className='rounded-md border border-dashed py-10 text-center text-muted-foreground'>
            No tools match your filter.{' '}
            <button
              type='button'
              className='font-medium text-foreground underline underline-offset-4'
              onClick={() => setParams({})}
            >
              Clear filters
            </button>
          </div>
        ) : filtering ? (
          <div className='grid gap-x-2 sm:grid-cols-2 lg:grid-cols-3'>
            {results.map((tool) => (
              <ToolRow key={tool.path} tool={tool} />
            ))}
          </div>
        ) : (
          <div className='flex flex-col gap-5'>
            {groupByCategory(results).map(([name, tools]) => (
              <section key={name}>
                <h2 className='mb-1 border-b px-2 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase'>
                  {name}
                </h2>
                <div className='grid gap-x-2 sm:grid-cols-2 lg:grid-cols-3'>
                  {tools.map((tool) => (
                    <ToolRow key={tool.path} tool={tool} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <footer className='mt-12 border-t pt-4 text-xs text-muted-foreground'>
        Open source on{' '}
        <a href={GITHUB_URL} className='underline-offset-4 hover:text-foreground hover:underline'>
          GitHub
        </a>
        . Self-host it with Docker.
      </footer>
    </div>
  )
}
