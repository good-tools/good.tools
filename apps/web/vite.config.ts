import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
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

export default defineConfig({
  plugins: [tailwindcss(), nodePolyfills({ include: ['buffer'], globals: { Buffer: true } }), react(), gzipAsset()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
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
    exclude: ['wasm-vips'],
  },

  server: { port: 3000, headers: crossOriginIsolation },
  preview: { port: 3000, headers: crossOriginIsolation },
})
