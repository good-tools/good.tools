/**
 * Runtime configuration interface
 * These values are injected at container startup from environment variables
 */
export interface RuntimeConfig {
  ENABLE_TELEMETRY: boolean
  GA_TRACKING_ID: string
  DISABLE_ONLINE_TOOLS: boolean
  INTERNET_TOOLS_URL: string
  IMAGE_BROWSER_URL: string
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig
  }
}

/**
 * Get runtime configuration with defaults for development
 */
export function getRuntimeConfig(): RuntimeConfig {
  // In development, use Vite env vars or defaults
  if (import.meta.env.DEV) {
    return {
      ENABLE_TELEMETRY: import.meta.env.VITE_ENABLE_TELEMETRY === 'true',
      GA_TRACKING_ID: import.meta.env.VITE_GA_TRACKING_ID || '',
      DISABLE_ONLINE_TOOLS: import.meta.env.VITE_DISABLE_ONLINE_TOOLS === 'true',
      INTERNET_TOOLS_URL: import.meta.env.VITE_INTERNET_TOOLS_URL || 'https://internet-tools.fly.dev',
      IMAGE_BROWSER_URL: import.meta.env.VITE_IMAGE_BROWSER_URL || 'https://image-browser.fly.dev',
    }
  }

  // In production, use runtime config injected by Docker entrypoint
  // Default: no telemetry, online tools disabled, empty API URLs
  return (
    window.__RUNTIME_CONFIG__ ?? {
      ENABLE_TELEMETRY: false,
      GA_TRACKING_ID: '',
      DISABLE_ONLINE_TOOLS: true,
      INTERNET_TOOLS_URL: '',
      IMAGE_BROWSER_URL: '',
    }
  )
}

export const runtimeConfig = getRuntimeConfig()
