/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

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

/** OpenCascade import (STEP / IGES / BREP); the result is typed as OcctResult in src/lib/cad.ts */
declare module 'occt-import-js' {
  export default function occtimportjs(module?: { locateFile?: (path: string) => string }): Promise<{
    ReadFile(format: 'step' | 'iges' | 'brep', content: Uint8Array, params: object | null): unknown
  }>
}
