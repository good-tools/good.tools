# MeshRepair

Part of the [good.tools monorepo](https://github.com/good-tools/good.tools/tree/master/packages/meshrepair); try it at [good.tools/stl-repair](https://good.tools/stl-repair).
[![npm](https://img.shields.io/npm/v/@goodtools/meshrepair)](https://www.npmjs.com/package/@goodtools/meshrepair)

The high-performance, WebAssembly-powered mesh repair engine for the browser.

MeshRepair is a lightweight, headless port of [VCGlib](https://github.com/cnr-isti-vclab/vcglib) (Visualization and Computer Graphics Library) specialized for the automated repair and sanitization of STL files. Built with Emscripten, it brings the industrial-grade mesh processing power of MeshLab directly into web-based 3D printing slicers, viewers, and CAD tools.

## Features

- **Fast**: Native-speed mesh processing via WebAssembly
- **Complete**: Full suite of mesh repair operations from VCGlib
- **Simple**: Clean TypeScript API with presets for common use cases
- **Flexible**: Works in browsers and Node.js
- **Lightweight**: No external dependencies, ~200-400KB WASM

## Installation

```bash
npm install @goodtools/meshrepair
```

## Usage

### Basic Usage

```typescript
import { MeshRepair } from '@goodtools/meshrepair';
import loadMeshRepair from '@goodtools/meshrepair/wasm';

// Initialize
const meshrepair = await MeshRepair.init(loadMeshRepair);

// Load and repair an STL file
const stlData = await fetch('/model.stl').then((r) => r.arrayBuffer());
const { result, output } = meshrepair.repair('model.stl', new Uint8Array(stlData), 'print-ready');

console.log(`Repaired: ${result.originalFaces} -> ${result.finalFaces} faces`);
console.log(`Holes filled: ${result.holesFilled}`);

// Download repaired file
const blob = new Blob([output], { type: 'application/octet-stream' });
const url = URL.createObjectURL(blob);
```

### Using Presets

MeshRepair includes three presets for common use cases:

```typescript
// Minimal - just remove duplicates and degenerate geometry
const { result } = meshrepair.repair('model.stl', data, 'minimal');

// Print-ready - fill holes, fix normals (recommended for 3D printing)
const { result } = meshrepair.repair('model.stl', data, 'print-ready');

// Aggressive - all repairs enabled
const { result } = meshrepair.repair('model.stl', data, 'aggressive');
```

### Custom Options

```typescript
import { MeshRepair, PRESETS } from '@goodtools/meshrepair';

const { result, output } = meshrepair.repair('model.stl', data, {
  // Start from a preset
  ...PRESETS['print-ready'],

  // Customize options
  maxHoleSize: 50, // Only fill holes with <=50 edges
  removeNonManifoldFace: true,
  removeNonManifoldVertex: true,
});
```

### Progress Callback

```typescript
const { result, output } = meshrepair.repair('model.stl', data, 'print-ready', (step, progress) => {
  console.log(`${step}: ${(progress * 100).toFixed(0)}%`);
});
```

### Large Files

For large files, write directly to the virtual filesystem to avoid extra memory copies:

```typescript
const meshrepair = await MeshRepair.init(loadMeshRepair);

// Write large file directly to virtual FS
meshrepair.FS.writeFile('/uploads/huge-model.stl', hugeBuffer);

// Repair by path (memory efficient)
const { result, outputPath } = meshrepair.repairFileInPlace('/uploads/huge-model.stl', {
  options: 'print-ready',
  onProgress: (step, p) => updateProgressBar(step, p),
});

// Read output when ready
const repairedData = meshrepair.FS.readFile(outputPath);
```

### Custom WASM Location

```typescript
const meshrepair = await MeshRepair.init(loadMeshRepair, {
  locateFile: (path, prefix) => {
    if (path.endsWith('.wasm')) return '/assets/meshrepair.wasm';
    return prefix + path;
  },
});
```

## API Reference

### `MeshRepair.init(loader, options?)`

Initialize the MeshRepair WASM module.

**Parameters:**

- `loader: MeshRepairLoader` - Function that loads the WASM module (import from `@goodtools/meshrepair/wasm`)
- `options?: InitOptions` - Optional initialization options
  - `locateFile?: (path: string, prefix: string) => string` - Custom function to locate WASM files

**Returns:** `Promise<MeshRepair>`

### `meshrepair.repair(name, data, options?, onProgress?)`

Repair an STL file by passing data directly.

**Parameters:**

- `name: string` - Filename (used for virtual FS path)
- `data: string | ArrayBufferView` - STL file data
- `options?: RepairOptions | PresetName` - Repair options or preset name
- `onProgress?: (step: string, progress: number) => void` - Progress callback

**Returns:** `{ result: RepairResult, output: Uint8Array }`

### `meshrepair.repairFile(inputPath, options?)`

Repair an STL file from a path in the virtual filesystem.

### `meshrepair.repairFileInPlace(inputPath, options?)`

Repair without reading output back to JavaScript (memory efficient).

### `meshrepair.FS`

Direct access to Emscripten virtual filesystem for large file handling.

### `meshrepair.destroy()`

Clean up resources.

## Repair Options

| Option                     | Type    | Default | Description                                   |
| -------------------------- | ------- | ------- | --------------------------------------------- |
| `removeDuplicateVertex`    | boolean | true    | Remove vertices at the same position          |
| `removeDuplicateFace`      | boolean | true    | Remove faces with identical vertex references |
| `removeUnreferencedVertex` | boolean | true    | Remove vertices not referenced by any face    |
| `removeDegenerateFace`     | boolean | true    | Remove faces with zero area                   |
| `fillHoles`                | boolean | false   | Fill holes in the mesh                        |
| `maxHoleSize`              | number  | 100     | Maximum hole size to fill (edge count)        |
| `removeNonManifoldFace`    | boolean | false   | Remove non-manifold faces                     |
| `removeNonManifoldVertex`  | boolean | false   | Remove non-manifold vertices                  |
| `fixNormalOrientation`     | boolean | false   | Make face orientations consistent             |
| `flipNormalsOutside`       | boolean | false   | Orient normals to point outward               |
| `removeTVertexByFlip`      | boolean | false   | Remove T-vertices by edge flipping            |
| `removeFaceFoldByFlip`     | boolean | false   | Remove face folds by edge flipping            |
| `binaryOutput`             | boolean | true    | Output binary STL (false for ASCII)           |

## Repair Result

```typescript
interface RepairResult {
  code: number; // 0 = success
  error?: string; // Error message if failed
  originalVertices: number; // Vertices before repair
  originalFaces: number; // Faces before repair
  finalVertices: number; // Vertices after repair
  finalFaces: number; // Faces after repair
  duplicateVerticesRemoved: number;
  duplicateFacesRemoved: number;
  unreferencedVerticesRemoved: number;
  degenerateFacesRemoved: number;
  nonManifoldFacesRemoved: number;
  nonManifoldVerticesRemoved: number;
  holesFilled: number;
}
```

## Building from source

The WebAssembly is compiled from `native/` (C++ with [VCGlib](https://github.com/cnr-isti-vclab/vcglib)) with Emscripten. VCGlib is pinned and checksum-verified in `upstream.json` and managed by [`wasmpatch`](../../tools/wasmpatch), which also handles any patches to it.

From the repository root:

```bash
bun install
bun run build          # builds everything; Turborepo skips unchanged packages
```

`bun run --cwd packages/meshrepair build:wasm` produces `wasm/meshrepair.{js,wasm}` the cheapest way available:

1. **Nothing to do** if `wasm/` was built from the same inputs (C++ sources, pins, patches, build tooling).
2. **Reuse a release:** if a published version was built from the same inputs, download its binaries. No toolchain needed.
3. **Compile** with Emscripten from `PATH` (`emcc`, `meson`, `ninja`), or else inside the pinned builder image ([`tools/wasmpatch/Dockerfile.emsdk`](../../tools/wasmpatch/Dockerfile.emsdk)), which needs only Docker.

Tests (`bun run --cwd packages/meshrepair test`) run against the built WebAssembly. Locally they're skipped when it hasn't been built; CI always builds it first.

## Releases

Releases are cut by [release-please](https://github.com/googleapis/release-please) from Conventional Commits, together with the rest of the good.tools monorepo, and published to npm with provenance.

## License

[GPL-3.0-or-later](LICENSE), like VCGlib.
