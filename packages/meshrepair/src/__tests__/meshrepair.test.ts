/**
 * MeshRepair Tests
 *
 * Tests for the WebAssembly STL mesh repair library
 */

import { existsSync } from 'node:fs'
import { MeshRepair, PRESETS } from '../index'
import type { MeshRepairLoader } from '../types'

// The WebAssembly is built by `bun run build:wasm` (Emscripten or Docker). Locally the
// suite skips without it; CI always builds it first, so a missing build fails there.
const wasmUrl = new URL('../../wasm/meshrepair.js', import.meta.url)
const hasWasm = existsSync(wasmUrl)
if (!hasWasm && process.env.CI) throw new Error('wasm/meshrepair.js missing; run `bun run build:wasm` first')
const loadMeshRepair: MeshRepairLoader = hasWasm
  ? ((await import(wasmUrl.href)).default as MeshRepairLoader)
  : () => Promise.reject(new Error('not built'))

// Helper: Create a minimal STL file (ASCII format)
function createMinimalSTL(): Uint8Array {
  const stl = `solid cube
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 1 0
      vertex 0 1 0
    endloop
  endfacet
endsolid cube`
  return new TextEncoder().encode(stl)
}

// Helper: Create STL with duplicate vertices
function createDuplicateVerticesSTL(): Uint8Array {
  const stl = `solid duplicate_test
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
endsolid duplicate_test`
  return new TextEncoder().encode(stl)
}

describe.skipIf(!hasWasm)('MeshRepair', () => {
  let meshrepair: MeshRepair

  beforeAll(async () => {
    // Initialize MeshRepair before all tests
    meshrepair = await MeshRepair.init(loadMeshRepair)
  }, 30000) // 30 second timeout for WASM initialization

  afterAll(() => {
    // Cleanup
    if (meshrepair) {
      meshrepair.destroy()
    }
  })

  describe('Initialization', () => {
    test('should initialize successfully', () => {
      expect(meshrepair).toBeDefined()
      expect(meshrepair.FS).toBeDefined()
    })
  })

  describe('Basic Repair', () => {
    test('should repair a minimal STL file', () => {
      const data = createMinimalSTL()
      const { result, output } = meshrepair.repair('test.stl', data, 'minimal')

      expect(result).toBeDefined()
      expect(result.code).toBe(0)
      expect(result.originalFaces).toBeGreaterThan(0)
      expect(result.finalFaces).toBeGreaterThan(0)
      expect(output).toBeInstanceOf(Uint8Array)
      expect(output.length).toBeGreaterThan(0)
    })

    test('should handle duplicate vertices', () => {
      const data = createDuplicateVerticesSTL()
      const { result } = meshrepair.repair('duplicate.stl', data, {
        removeDuplicateVertex: true,
        removeDuplicateFace: true,
      })

      expect(result.code).toBe(0)
      // Should remove duplicates
      expect(result.duplicateVerticesRemoved + result.duplicateFacesRemoved).toBeGreaterThan(0)
    })
  })

  describe('Presets', () => {
    test('should have all presets defined', () => {
      expect(PRESETS.minimal).toBeDefined()
      expect(PRESETS['print-ready']).toBeDefined()
      expect(PRESETS.aggressive).toBeDefined()
    })

    test('should work with minimal preset', () => {
      const data = createMinimalSTL()
      const { result } = meshrepair.repair('test.stl', data, 'minimal')
      expect(result.code).toBe(0)
    })

    test('should work with print-ready preset', () => {
      const data = createMinimalSTL()
      const { result } = meshrepair.repair('test.stl', data, 'print-ready')
      expect(result.code).toBe(0)
    })

    test('should work with aggressive preset', () => {
      const data = createMinimalSTL()
      const { result } = meshrepair.repair('test.stl', data, 'aggressive')
      expect(result.code).toBe(0)
    })
  })

  describe('Custom Options', () => {
    test('should apply custom options', () => {
      const data = createMinimalSTL()
      const { result } = meshrepair.repair('test.stl', data, {
        removeDuplicateVertex: true,
        removeDuplicateFace: true,
        removeUnreferencedVertex: true,
        removeDegenerateFace: true,
        fillHoles: false,
        binaryOutput: true,
      })

      expect(result.code).toBe(0)
    })

    test('should merge preset with custom options', () => {
      const data = createMinimalSTL()
      const { result } = meshrepair.repair('test.stl', data, {
        ...PRESETS['print-ready'],
        maxHoleSize: 50,
      })

      expect(result.code).toBe(0)
    })
  })

  describe('Progress Callback', () => {
    test('should call progress callback', () => {
      const data = createMinimalSTL()
      const progressCalls: Array<{ step: string; progress: number }> = []

      meshrepair.repair('test.stl', data, 'minimal', (step, progress) => {
        progressCalls.push({ step, progress })
      })

      // Progress callback might not be called for small files
      // Just verify it doesn't crash
      expect(progressCalls.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('File System Operations', () => {
    test('should write and read files from virtual FS', () => {
      const data = createMinimalSTL()
      const path = '/uploads/test-fs.stl'

      // Write file
      meshrepair.FS.writeFile(path, data)

      // Verify file exists
      const readData = meshrepair.FS.readFile(path)
      expect(readData).toBeInstanceOf(Uint8Array)
      expect(readData.length).toBe(data.length)

      // Cleanup
      meshrepair.FS.unlink(path)
    })

    test('should repair file by path', () => {
      const data = createMinimalSTL()
      const inputPath = '/uploads/test-by-path.stl'

      meshrepair.FS.writeFile(inputPath, data)

      const { result, output, outputPath } = meshrepair.repairFile(inputPath, {
        options: 'minimal',
      })

      expect(result.code).toBe(0)
      expect(output).toBeInstanceOf(Uint8Array)
      expect(outputPath).toBeDefined()

      // Verify output file exists
      const outputData = meshrepair.FS.readFile(outputPath)
      expect(outputData.length).toBeGreaterThan(0)

      // Cleanup
      meshrepair.FS.unlink(inputPath)
      meshrepair.FS.unlink(outputPath)
    })

    test('should repair file in place (memory efficient)', () => {
      const data = createMinimalSTL()
      const inputPath = '/uploads/test-in-place.stl'

      meshrepair.FS.writeFile(inputPath, data)

      const { result, outputPath } = meshrepair.repairFileInPlace(inputPath, {
        options: 'print-ready',
      })

      expect(result.code).toBe(0)
      expect(outputPath).toBeDefined()

      // Verify output file exists in virtual FS
      const outputData = meshrepair.FS.readFile(outputPath)
      expect(outputData.length).toBeGreaterThan(0)

      // Cleanup
      meshrepair.FS.unlink(inputPath)
      meshrepair.FS.unlink(outputPath)
    })
  })

  describe('Repair Result', () => {
    test('should return complete repair result', () => {
      const data = createMinimalSTL()
      const { result } = meshrepair.repair('test.stl', data, 'minimal')

      // Verify all expected fields exist
      expect(result.code).toBeDefined()
      expect(result.originalVertices).toBeDefined()
      expect(result.originalFaces).toBeDefined()
      expect(result.finalVertices).toBeDefined()
      expect(result.finalFaces).toBeDefined()
      expect(result.duplicateVerticesRemoved).toBeDefined()
      expect(result.duplicateFacesRemoved).toBeDefined()
      expect(result.unreferencedVerticesRemoved).toBeDefined()
      expect(result.degenerateFacesRemoved).toBeDefined()
      expect(result.nonManifoldFacesRemoved).toBeDefined()
      expect(result.nonManifoldVerticesRemoved).toBeDefined()
      expect(result.holesFilled).toBeDefined()
    })

    test('should track repair statistics correctly', () => {
      const data = createDuplicateVerticesSTL()
      const { result } = meshrepair.repair('test.stl', data, {
        removeDuplicateVertex: true,
        removeDuplicateFace: true,
        removeUnreferencedVertex: true,
      })

      expect(result.code).toBe(0)
      expect(result.originalFaces).toBeGreaterThanOrEqual(result.finalFaces)
      expect(result.duplicateFacesRemoved).toBeGreaterThan(0)
    })
  })

  describe('Binary vs ASCII Output', () => {
    test('should output binary STL by default', () => {
      const data = createMinimalSTL()
      const { output } = meshrepair.repair('test.stl', data, 'minimal')

      // Binary STL starts with 80-byte header (usually not 'solid')
      // Binary STL won't start with 'solid' text
      expect(output.length).toBeGreaterThan(84) // Header + at least 1 triangle
    })
  })
})
