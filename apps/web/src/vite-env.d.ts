/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string

/** URL of a gzipped copy of the file (see gzipAsset in vite.config.ts) */
declare module '*?gzip' {
  const url: string
  export default url
}

/** pandoc-wasm's loader-free core (aliased in vite.config.ts; the package only exports its auto-loading entry) */
declare module 'pandoc-wasm/src/core.js' {
  interface ConvertResult {
    stdout: string
    stderr: string
    warnings: { verbosity?: string; pretty?: string }[]
    files: Record<string, Blob>
  }
  export function createPandocInstance(wasm: ArrayBuffer): Promise<{
    convert(
      options: Record<string, unknown>,
      stdin: string | null,
      files: Record<string, Blob | string>,
    ): Promise<ConvertResult>
    query(options: { query: string; format?: string }): unknown
  }>
}

interface ImportMetaEnv {
  readonly VITE_ENABLE_TELEMETRY?: string
  readonly VITE_GA_TRACKING_ID?: string
  readonly VITE_DISABLE_ONLINE_TOOLS?: string
  readonly VITE_API_URL?: string
}
