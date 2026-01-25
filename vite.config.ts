import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'



// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // mockWsPlugin,
    wasm(),
    topLevelAwait(),
    nodePolyfills(),
    react()
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Buffer polyfill for browser
      buffer: "buffer",
      'ws': path.resolve(__dirname, "./src/ws-mock.ts"),
    },
  },

  // Web Worker configuration
  worker: {
    format: 'es', // Forces the Webpack-style self-contained format
    plugins: () => [
      // mockWsPlugin,
      // Add polyfills here so they are bundled into the IIFE
      nodePolyfills({ globals: { Buffer: true } })
    ]
  },

  // Build optimizations
  build: {
    target: "es2020",
    rollupOptions: {
      // external: ['ws'],
      output: {
        manualChunks: {
          // Separate Monaco Editor into its own chunk (~2MB)
          "monaco-editor": ["@monaco-editor/react"],
          // Separate vendor libraries
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@headlessui/react",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
          ],
          "vendor-data": [
            "@tanstack/react-query",
            "@tanstack/react-table",
            "@tanstack/react-virtual",
          ],
        },
      },
    },
    // Increase chunk size warning limit for large dependencies
    chunkSizeWarningLimit: 1000,
    // Ensure .gz files are treated as assets
    assetsInlineLimit: 0,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      "@goodtools/wiregasm",
      "@goodtools/wiregasm/dist/wiregasm",
      "@goodtools/meshrepair",
      "@goodtools/meshrepair/dist/meshrepair.js",
      "pako",
      "buffer"
    ],
    // Exclude wasm-vips so it can load its WASM file correctly
    exclude: ["wasm-vips"],
  },

  // Server configuration
  server: {
    port: 3000,
    open: true,
    headers: {
      // Required for SharedArrayBuffer (wasm-vips multi-threading)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // Preview server configuration
  preview: {
    port: 3000,
    headers: {
      // Required for SharedArrayBuffer (wasm-vips multi-threading)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
