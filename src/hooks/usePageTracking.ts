import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { runtimeConfig } from '@/config/runtime.config'

/**
 * Google Analytics page view tracking interface
 */
interface GtagPageView {
  page_path: string
  page_search: string
  page_hash: string
}

/**
 * Extend Window interface for gtag
 */
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params: GtagPageView) => void
  }
}

/**
 * Hook for tracking page views with Google Analytics
 * Automatically tracks on route changes
 * Respects ENABLE_TELEMETRY runtime config
 */
export function usePageTracking(): void {
  const location = useLocation()

  useEffect(() => {
    // Skip tracking if telemetry is disabled
    if (!runtimeConfig.ENABLE_TELEMETRY) return

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search + location.hash,
        page_search: location.search,
        page_hash: location.hash,
      })
    }
  }, [location])
}
