import { Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import WrappedTool from '@/pages/WrappedTool'
import { filteredTools } from '@/config/tools.config'
import { Layout } from '@/pages/Layout'
import NotFound from '@/pages/NotFound'
import { usePageTracking } from '@/hooks/usePageTracking'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'

function App() {
  usePageTracking()

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path='/' element={<Home />} />
          {filteredTools.map((tool, idx) => (
            <Route key={`r-${idx}`} path={tool.href} element={<WrappedTool tool={tool} />} />
          ))}
          <Route path='*' element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

export default App
