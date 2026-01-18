# Trigasm

[![Build](https://github.com/good-tools/trigasm/actions/workflows/ci.yml/badge.svg)](https://github.com/good-tools/trigasm/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@goodtools/trigasm)](https://www.npmjs.com/package/@goodtools/trigasm)

The high-performance, WebAssembly-powered mesh repair engine for the browser.

Trigasm is a lightweight, headless port of [VCGlib](https://github.com/cnr-isti-vclab/vcglib) (Visualization and Computer Graphics Library) specialized for the automated repair and sanitization of STL files. Built with Emscripten, it brings the industrial-grade mesh processing power of MeshLab directly into web-based 3D printing slicers, viewers, and CAD tools.

## Features

- **Fast**: Native-speed mesh processing via WebAssembly
- **Complete**: Full suite of mesh repair operations from VCGlib
- **Simple**: Clean TypeScript API with presets for common use cases
- **Flexible**: Works in browsers and Node.js
- **Lightweight**: No external dependencies, ~200-400KB WASM

## Installation

```bash
npm install @goodtools/trigasm
```

## Usage

### Basic Usage

```typescript
import { Trigasm } from '@goodtools/trigasm';

// Initialize
const trigasm = await Trigasm.init();

// Load and repair an STL file
const stlData = await fetch('/model.stl').then((r) => r.arrayBuffer());
const { result, output } = trigasm.repair('model.stl', new Uint8Array(stlData), 'print-ready');

console.log(`Repaired: ${result.originalFaces} -> ${result.finalFaces} faces`);
console.log(`Holes filled: ${result.holesFilled}`);

// Download repaired file
const blob = new Blob([output], { type: 'application/octet-stream' });
const url = URL.createObjectURL(blob);
```

### Using Presets

Trigasm includes three presets for common use cases:

```typescript
// Minimal - just remove duplicates and degenerate geometry
const { result } = trigasm.repair('model.stl', data, 'minimal');

// Print-ready - fill holes, fix normals (recommended for 3D printing)
const { result } = trigasm.repair('model.stl', data, 'print-ready');

// Aggressive - all repairs enabled
const { result } = trigasm.repair('model.stl', data, 'aggressive');
```

### Custom Options

```typescript
import { Trigasm, PRESETS } from '@goodtools/trigasm';

const { result, output } = trigasm.repair('model.stl', data, {
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
const { result, output } = trigasm.repair('model.stl', data, 'print-ready', (step, progress) => {
  console.log(`${step}: ${(progress * 100).toFixed(0)}%`);
});
```

### Large Files

For large files, write directly to the virtual filesystem to avoid extra memory copies:

```typescript
const trigasm = await Trigasm.init();

// Write large file directly to virtual FS
trigasm.FS.writeFile('/uploads/huge-model.stl', hugeBuffer);

// Repair by path (memory efficient)
const { result, outputPath } = trigasm.repairFileInPlace('/uploads/huge-model.stl', {
  options: 'print-ready',
  onProgress: (step, p) => updateProgressBar(step, p),
});

// Read output when ready
const repairedData = trigasm.FS.readFile(outputPath);
```

### Custom WASM Location

```typescript
const trigasm = await Trigasm.init({
  locateFile: (path, prefix) => {
    if (path.endsWith('.wasm')) return '/assets/trigasm.wasm';
    return prefix + path;
  },
});
```

## API Reference

### `Trigasm.init(options?)`

Initialize the Trigasm WASM module.

**Options:**

- `locateFile?: (path: string, prefix: string) => string` - Custom function to locate WASM files

**Returns:** `Promise<Trigasm>`

### `trigasm.repair(name, data, options?, onProgress?)`

Repair an STL file by passing data directly.

**Parameters:**

- `name: string` - Filename (used for virtual FS path)
- `data: string | ArrayBufferView` - STL file data
- `options?: RepairOptions | PresetName` - Repair options or preset name
- `onProgress?: (step: string, progress: number) => void` - Progress callback

**Returns:** `{ result: RepairResult, output: Uint8Array }`

### `trigasm.repairFile(inputPath, options?)`

Repair an STL file from a path in the virtual filesystem.

### `trigasm.repairFileInPlace(inputPath, options?)`

Repair without reading output back to JavaScript (memory efficient).

### `trigasm.FS`

Direct access to Emscripten virtual filesystem for large file handling.

### `trigasm.destroy()`

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

## Build

### Prerequisites

- Docker
- Node.js 18+

### Building

```bash
# Build the Docker image with Emscripten
docker build -t goodtools/trigasm-builder -f docker/build.Dockerfile .

# Build the WASM library
npm run build:emscripten

# Build the TypeScript wrapper
npm install
npm run build
```

### Local Build (without Docker)

Requires Emscripten SDK, Meson, and Ninja installed locally.

```bash
npm run build:emscripten-local
npm run build
```

## License

Trigasm is licensed under the [GNU General Public License v3.0](LICENSE), the same license as [VCGlib](https://github.com/cnr-isti-vclab/vcglib).

VCGlib is developed by the [Visual Computing Lab](http://vcg.isti.cnr.it) at ISTI-CNR.

## Credits

- [VCGlib](https://github.com/cnr-isti-vclab/vcglib) - The underlying mesh processing library
- [MeshLab](https://www.meshlab.net/) - VCGlib's flagship application
- [Emscripten](https://emscripten.org/) - C++ to WebAssembly compiler
- [Wiregasm](https://github.com/good-tools/wiregasm) - Architectural inspiration
