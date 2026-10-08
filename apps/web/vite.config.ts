import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig, type Plugin } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Required for SharedArrayBuffer (wasm-vips multi-threading)
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

/**
 * `import url from 'big.wasm?gzip'` emits the file gzipped, for files over the host's 25 MiB per-file limit
 * (fetch it with fetchInflated). The dev server serves the original file.
 */
function gzipAsset(): Plugin {
  let dev = false
  return {
    name: 'gzip-asset',
    enforce: 'pre',
    configResolved: (config) => {
      dev = config.command === 'serve'
    },
    // Virtual id: the original file must not be loaded as a module
    async resolveId(source, importer) {
      if (!source.endsWith('?gzip')) return
      const resolved = await this.resolve(source.slice(0, -'?gzip'.length), importer)
      return resolved && `\0gzip:${resolved.id}`
    },
    load(id) {
      if (!id.startsWith('\0gzip:')) return
      const file = id.slice('\0gzip:'.length)
      if (dev) return `export default ${JSON.stringify(`/@fs${file}`)}`
      const source = gzipSync(readFileSync(file), { level: 9 })
      const ref = this.emitFile({ type: 'asset', name: `${path.basename(file)}.gz`, source })
      return `export default import.meta.ROLLUP_FILE_URL_${ref}`
    },
  }
}

// The entry chunk and everything it statically imports: the app shell the service worker precaches
const shell = new Set<string>()
const collectShell: Plugin = {
  name: 'collect-app-shell',
  apply: 'build',
  generateBundle(_, bundle) {
    const add = (file: string) => {
      const chunk = bundle[file]
      if (shell.has(file) || chunk?.type !== 'chunk') return
      shell.add(file)
      for (const css of chunk.viteMetadata?.importedCss ?? []) shell.add(css)
      chunk.imports.forEach(add)
    }
    for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) add(chunk.fileName)
  },
}

export default defineConfig({
  plugins: [
    gzipAsset(),
    tailwindcss(),
    nodePolyfills({ include: ['buffer'], globals: { Buffer: true } }),
    react(),
    collectShell,
    // Offline support. Cached responses keep their COOP/COEP headers, so the app stays
    // cross-origin isolated when served from the cache.
    VitePWA({
      registerType: 'prompt',
      manifest: false, // public/manifest.json
      workbox: {
        // Precache only the app shell; tool chunks, wasm and models are cached on first use below
        globPatterns: [
          '*.{html,svg,ico,png}',
          'manifest.json',
          'assets/*.{js,css}',
          'assets/*-latin-wght-normal-*.woff2',
        ],
        manifestTransforms: [
          async (entries) => ({ manifest: entries.filter((e) => !/\.(js|css)$/.test(e.url) || shell.has(e.url)) }),
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(\/|$)/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Runtime config (no-store on the server): fresh when online, last copy offline
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname === '/config.js',
            handler: 'NetworkFirst',
            options: { cacheName: 'config' },
          },
          // Content-hashed, so never stale. /api and other origins are never cached.
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'assets', expiration: { maxEntries: 500, purgeOnQuotaError: true } },
          },
          // Speech to Text's runtime and model (src/whisper-assets.ts); their paths change with their versions
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/whisper/'),
            handler: 'CacheFirst',
            options: { cacheName: 'models', expiration: { maxEntries: 50, purgeOnQuotaError: true } },
          },
        ],
      },
    }),
  ],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    // ONNX Runtime's default bundle embeds a 26 MB wasm, over Cloudflare's 25 MiB per-file limit;
    // this condition picks its build that loads the runtime from paths we set (see whisper.worker.ts)
    // (not under Vitest: browser conditions would make jsdom tests load packages' browser builds)
    conditions: process.env.VITEST ? undefined : ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      ws: path.resolve(import.meta.dirname, './src/ws-mock.ts'),
    },
  },

  worker: {
    format: 'es',
    plugins: () => [nodePolyfills({ include: ['buffer'], globals: { Buffer: true } })],
  },

  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    // Keep .gz wasm payloads as separate files
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // Tesseract fetches `${langPath}/eng.traineddata.gz` itself, so the name must not be hashed
        assetFileNames: ({ names }) =>
          names[0]?.endsWith('.traineddata.gz')
            ? 'assets/tessdata-4.0.0_best_int/[name][extname]'
            : 'assets/[name]-[hash][extname]',
      },
      onwarn(warning, warn) {
        // wasm-vips' emscripten glue uses eval; nothing we can change
        if (warning.code === 'EVAL') return
        warn(warning)
      },
    },
  },

  optimizeDeps: {
    // wasm-vips must load its own .wasm next to the JS file
    // ffmpeg.wasm spawns its worker from its own files
    // YARA-X loads its .wasm relative to its JS file
    exclude: ['wasm-vips', '@ffmpeg/ffmpeg', '@virustotal/yara-x'],
  },

  server: { port: 3000, headers: crossOriginIsolation },
  preview: { port: 3000, headers: crossOriginIsolation },
})
