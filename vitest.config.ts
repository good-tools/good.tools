/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [nodePolyfills() as any, react() as any],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'src/test/'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            buffer: 'buffer',
        },
    },
})
