import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  platform: 'neutral',
  // the Emscripten loader + binary built by `bun run build:wasm`, and the loader's types
  // (inputs.sha256 lets later builds reuse these binaries; see scripts/build-wasm.mjs)
  copy: ['wasm/meshrepair.js', 'wasm/meshrepair.wasm', 'wasm/inputs.sha256', 'types/meshrepair.d.ts'],
})
