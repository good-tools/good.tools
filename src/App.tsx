import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import Home from '@/pages/Home'
import WrappedTool from '@/pages/WrappedTool'
import NotFound from '@/pages/NotFound'
import { Layout } from '@/pages/Layout'
import { availableTools } from '@/config/tools.config'
import { runtimeConfig } from '@/config/runtime.config'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'

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
