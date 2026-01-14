import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Buffer polyfill for browser
      buffer: "buffer",
    },
  },

  // Web Worker configuration
  worker: {
    format: "es",
  },

  // Build optimizations
  build: {
    target: "es2020",
    rollupOptions: {
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
  },

  // Optimize dependencies
  optimizeDeps: {
    // Exclude large WASM binary from optimization
    exclude: ["@goodtools/wiregasm"],
    include: ["buffer"],
  },

  // Server configuration
  server: {
    port: 3000,
    open: true,
  },

  // Preview server configuration
  preview: {
    port: 3000,
  },
});
