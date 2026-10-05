/// <reference types="vite/client" />

declare const __APP_VERSION__: string

/** URL of a gzipped copy of the file (see gzipAsset in vite.config.ts) */
declare module '*?gzip' {
  const url: string
  export default url
}

interface ImportMetaEnv {
  readonly VITE_ENABLE_TELEMETRY?: string
  readonly VITE_GA_TRACKING_ID?: string
  readonly VITE_DISABLE_ONLINE_TOOLS?: string
  readonly VITE_API_URL?: string
}
