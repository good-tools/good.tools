/**
 * Runtime configuration, injected at container startup (see docker/entrypoint.sh → /config.js).
 * In dev, values come from VITE_* env vars instead.
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

const defaults: RuntimeConfig = {
  ENABLE_TELEMETRY: false,
  GA_TRACKING_ID: '',
  DISABLE_ONLINE_TOOLS: true,
  INTERNET_TOOLS_URL: '',
  IMAGE_BROWSER_URL: '',
}

export function getRuntimeConfig(): RuntimeConfig {
  const env = import.meta.env
  if (env?.DEV) {
    return {
      ENABLE_TELEMETRY: env.VITE_ENABLE_TELEMETRY === 'true',
      GA_TRACKING_ID: env.VITE_GA_TRACKING_ID || '',
      DISABLE_ONLINE_TOOLS: env.VITE_DISABLE_ONLINE_TOOLS === 'true',
      INTERNET_TOOLS_URL: env.VITE_INTERNET_TOOLS_URL || 'https://internet-tools.fly.dev',
      IMAGE_BROWSER_URL: env.VITE_IMAGE_BROWSER_URL || 'https://image-browser.fly.dev',
    }
  }
  // globalThis.window: this module is also imported by the sitemap script outside the browser
  return { ...defaults, ...globalThis.window?.__RUNTIME_CONFIG__ }
}

export const runtimeConfig = getRuntimeConfig()
