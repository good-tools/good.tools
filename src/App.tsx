import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { runtimeConfig } from '@/config/runtime.config'
import { availableTools } from '@/config/tools.config'
import Home from '@/pages/Home'
import { Layout } from '@/pages/Layout'
import NotFound from '@/pages/NotFound'
import WrappedTool from '@/pages/WrappedTool'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function usePageTracking() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    if (runtimeConfig.ENABLE_TELEMETRY) window.gtag?.('event', 'page_view', { page_path: pathname + search + hash })
  }, [pathname, search, hash])
}

export default function App() {
  usePageTracking()

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          {availableTools.map((tool) => (
            <Route key={tool.path} path={tool.path} element={<WrappedTool tool={tool} />} />
          ))}
          <Route path='*' element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
