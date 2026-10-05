import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import pkg from './package.json' with { type: 'json' }

// Required for SharedArrayBuffer (wasm-vips multi-threading)
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [tailwindcss(), nodePolyfills({ include: ['buffer'], globals: { Buffer: true } }), react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    // ONNX Runtime's default bundle embeds a 26 MB wasm, over Cloudflare's 25 MiB per-file limit;
    // this condition picks its build that loads the runtime from paths we set (see whisper.worker.ts)
    conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
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
