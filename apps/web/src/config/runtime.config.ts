/**
 * Runtime configuration, injected at container startup (see docker/entrypoint.sh → /config.js).
 * In dev, values come from VITE_* env vars instead.
 */
export interface RuntimeConfig {
  ENABLE_TELEMETRY: boolean
  GA_TRACKING_ID: string
  DISABLE_ONLINE_TOOLS: boolean
  /** Base URL of the good.tools API (services/api), e.g. https://api.good.tools or /api */
  API_URL: string
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
  API_URL: '',
}

export function getRuntimeConfig(): RuntimeConfig {
  const env = import.meta.env
  if (env?.DEV) {
    return {
      ENABLE_TELEMETRY: env.VITE_ENABLE_TELEMETRY === 'true',
      GA_TRACKING_ID: env.VITE_GA_TRACKING_ID || '',
      DISABLE_ONLINE_TOOLS: env.VITE_DISABLE_ONLINE_TOOLS === 'true',
      API_URL: env.VITE_API_URL || 'https://api.good.tools',
    }
  }
  // globalThis.window: this module is also imported by the sitemap script outside the browser
  return { ...defaults, ...globalThis.window?.__RUNTIME_CONFIG__ }
}

export const runtimeConfig = getRuntimeConfig()
