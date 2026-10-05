import { NavList } from '@/components/shell/Sidebar'
import { isMac, Kbd } from '@/components/ui/kbd'
import { availableTools } from '@/config/tools.config'
import { useLayoutStore } from '@/stores/useLayoutStore'

export default function Home() {
  const setPaletteOpen = useLayoutStore((s) => s.setPaletteOpen)

  return (
    <div className='flex min-h-full flex-col'>
      <title>good.tools · Developer tools that run in your browser</title>
      <meta
        name='description'
        content='Free, fast, privacy-focused developer tools that run entirely in your browser.'
      />

      <div className='flex flex-col items-center px-6 pt-10 pb-4 text-center md:flex-1 md:justify-center md:pb-24'>
        <h1 className='text-[13px] font-semibold'>Developer tools that run in your browser</h1>
        <p className='mt-1 max-w-sm text-xs text-muted-foreground'>
          {availableTools.length} free tools. Most never send your data anywhere; online ones are marked{' '}
          <span
            className='inline-block size-1.5 rounded-full bg-warning align-middle'
            role='img'
            aria-label='orange dot'
          />
          .
        </p>
        <button
          type='button'
          onClick={() => setPaletteOpen(true)}
          className='mt-4 hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground md:inline-flex'
        >
          Pick a tool from the sidebar, or search
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      {/* The sidebar is a drawer on small screens, so list the tools here instead */}
      <div className='border-t md:hidden'>
        <NavList />
      </div>
    </div>
  )
}
