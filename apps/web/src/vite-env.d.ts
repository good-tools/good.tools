/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_ENABLE_TELEMETRY?: string
  readonly VITE_GA_TRACKING_ID?: string
  readonly VITE_DISABLE_ONLINE_TOOLS?: string
  readonly VITE_API_URL?: string
}
