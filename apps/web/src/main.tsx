import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@/assets/styles/index.css'
import '@/stores/theme.store'
import App from '@/App'
import { UpdatePrompt } from '@/components/layout/UpdatePrompt'

// After a deploy, a tab still running the previous version can't load its lazy chunks (they're
// gone from the server). Reload once to pick up the new version; the flag stops a reload loop.
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem('reloaded-for-chunk')) return
  event.preventDefault()
  sessionStorage.setItem('reloaded-for-chunk', '1')
  void reloadToLatest()
})

// The old service worker would serve the old version again, so switch to the new one first
async function reloadToLatest() {
  const reg = await navigator.serviceWorker?.getRegistration()
  await reg?.update().catch(() => {})
  const next = reg?.installing ?? reg?.waiting
  if (!next) return window.location.reload()
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())
  const skip = () => next.state === 'installed' && next.postMessage({ type: 'SKIP_WAITING' })
  next.addEventListener('statechange', skip)
  skip()
}
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('reloaded-for-chunk'), 10_000))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <UpdatePrompt />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
