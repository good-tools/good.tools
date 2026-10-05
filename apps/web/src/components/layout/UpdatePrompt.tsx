import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

// A new version is waiting in the service worker: offer a reload instead of interrupting work.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Long-lived tabs: look for a new deploy hourly
    onRegisteredSW: (_url, reg) => reg && setInterval(() => reg.update(), 60 * 60 * 1000),
  })
  if (!needRefresh) return null
  return (
    <div
      role='status'
      className='fixed right-3 bottom-3 z-50 flex items-center gap-2 rounded-md border bg-background py-1 pr-1 pl-2.5 text-xs shadow-sm'
    >
      Update available
      <Button size='sm' onClick={() => updateServiceWorker(true)}>
        Reload
      </Button>
    </div>
  )
}
