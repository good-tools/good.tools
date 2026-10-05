/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_ENABLE_TELEMETRY?: string
  readonly VITE_GA_TRACKING_ID?: string
  readonly VITE_DISABLE_ONLINE_TOOLS?: string
  readonly VITE_INTERNET_TOOLS_URL?: string
  readonly VITE_IMAGE_BROWSER_URL?: string
}
