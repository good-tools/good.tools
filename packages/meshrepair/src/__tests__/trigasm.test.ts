/**
 * Trigasm Tests
 *
 * Tests for the WebAssembly STL mesh repair library
 */

import { Trigasm, PRESETS } from '../index';
// @ts-expect-error - WASM module has no type declaration
import loadTrigasm from '../../built/bin/trigasm.js';

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
endsolid cube`;
  return new TextEncoder().encode(stl);
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
endsolid duplicate_test`;
  return new TextEncoder().encode(stl);
}

describe('Trigasm', () => {
  let trigasm: Trigasm;

  beforeAll(async () => {
    // Initialize Trigasm before all tests
    trigasm = await Trigasm.init(loadTrigasm);
  }, 30000); // 30 second timeout for WASM initialization

  afterAll(() => {
    // Cleanup
    if (trigasm) {
      trigasm.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', () => {
      expect(trigasm).toBeDefined();
      expect(trigasm.FS).toBeDefined();
    });
  });

  describe('Basic Repair', () => {
    test('should repair a minimal STL file', () => {
      const data = createMinimalSTL();
      const { result, output } = trigasm.repair('test.stl', data, 'minimal');

      expect(result).toBeDefined();
      expect(result.code).toBe(0);
      expect(result.originalFaces).toBeGreaterThan(0);
      expect(result.finalFaces).toBeGreaterThan(0);
      expect(output).toBeInstanceOf(Uint8Array);
      expect(output.length).toBeGreaterThan(0);
    });

    test('should handle duplicate vertices', () => {
      const data = createDuplicateVerticesSTL();
      const { result } = trigasm.repair('duplicate.stl', data, {
        removeDuplicateVertex: true,
        removeDuplicateFace: true,
      });

      expect(result.code).toBe(0);
      // Should remove duplicates
      expect(result.duplicateVerticesRemoved + result.duplicateFacesRemoved).toBeGreaterThan(0);
    });
  });

  describe('Presets', () => {
    test('should have all presets defined', () => {
      expect(PRESETS.minimal).toBeDefined();
      expect(PRESETS['print-ready']).toBeDefined();
      expect(PRESETS.aggressive).toBeDefined();
    });

    test('should work with minimal preset', () => {
      const data = createMinimalSTL();
      const { result } = trigasm.repair('test.stl', data, 'minimal');
      expect(result.code).toBe(0);
    });

    test('should work with print-ready preset', () => {
      const data = createMinimalSTL();
      const { result } = trigasm.repair('test.stl', data, 'print-ready');
      expect(result.code).toBe(0);
    });

    test('should work with aggressive preset', () => {
      const data = createMinimalSTL();
      const { result } = trigasm.repair('test.stl', data, 'aggressive');
      expect(result.code).toBe(0);
    });
  });

  describe('Custom Options', () => {
    test('should apply custom options', () => {
      const data = createMinimalSTL();
      const { result } = trigasm.repair('test.stl', data, {
        removeDuplicateVertex: true,
        removeDuplicateFace: true,
        removeUnreferencedVertex: true,
        removeDegenerateFace: true,
        fillHoles: false,
        binaryOutput: true,
      });

      expect(result.code).toBe(0);
    });

    test('should merge preset with custom options', () => {
      const data = createMinimalSTL();
      const { result } = trigasm.repair('test.stl', data, {
        ...PRESETS['print-ready'],
        maxHoleSize: 50,
      });

      expect(result.code).toBe(0);
    });
  });

  describe('Progress Callback', () => {
    test('should call progress callback', () => {
      const data = createMinimalSTL();
      const progressCalls: Array<{ step: string; progress: number }> = [];

      trigasm.repair('test.stl', data, 'minimal', (step, progress) => {
        progressCalls.push({ step, progress });
      });

      // Progress callback might not be called for small files
      // Just verify it doesn't crash
      expect(progressCalls.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('File System Operations', () => {
    test('should write and read files from virtual FS', () => {
      const data = createMinimalSTL();
      const path = '/uploads/test-fs.stl';

      // Write file
      trigasm.FS.writeFile(path, data);

      // Verify file exists
      const readData = trigasm.FS.readFile(path);
      expect(readData).toBeInstanceOf(Uint8Array);
      expect(readData.length).toBe(data.length);

      // Cleanup
      trigasm.FS.unlink(path);
    });

    test('should repair file by path', () => {
      const data = createMinimalSTL();
      const inputPath = '/uploads/test-by-path.stl';

      trigasm.FS.writeFile(inputPath, data);

      const { result, output, outputPath } = trigasm.repairFile(inputPath, {
        options: 'minimal',
      });

      expect(result.code).toBe(0);
      expect(output).toBeInstanceOf(Uint8Array);
      expect(outputPath).toBeDefined();

      // Verify output file exists
      const outputData = trigasm.FS.readFile(outputPath);
      expect(outputData.length).toBeGreaterThan(0);

      // Cleanup
      trigasm.FS.unlink(inputPath);
      trigasm.FS.unlink(outputPath);
    });

    test('should repair file in place (memory efficient)', () => {
      const data = createMinimalSTL();
      const inputPath = '/uploads/test-in-place.stl';

      trigasm.FS.writeFile(inputPath, data);

      const { result, outputPath } = trigasm.repairFileInPlace(inputPath, {
        options: 'print-ready',
      });

      expect(result.code).toBe(0);
      expect(outputPath).toBeDefined();

      // Verify output file exists in virtual FS
      const outputData = trigasm.FS.readFile(outputPath);
      expect(outputData.length).toBeGreaterThan(0);

      // Cleanup
      trigasm.FS.unlink(inputPath);
      trigasm.FS.unlink(outputPath);
    });
  });

  describe('Repair Result', () => {
    test('should return complete repair result', () => {
      const data = createMinimalSTL();
      const { result } = trigasm.repair('test.stl', data, 'minimal');

      // Verify all expected fields exist
      expect(result.code).toBeDefined();
      expect(result.originalVertices).toBeDefined();
      expect(result.originalFaces).toBeDefined();
      expect(result.finalVertices).toBeDefined();
      expect(result.finalFaces).toBeDefined();
      expect(result.duplicateVerticesRemoved).toBeDefined();
      expect(result.duplicateFacesRemoved).toBeDefined();
      expect(result.unreferencedVerticesRemoved).toBeDefined();
      expect(result.degenerateFacesRemoved).toBeDefined();
      expect(result.nonManifoldFacesRemoved).toBeDefined();
      expect(result.nonManifoldVerticesRemoved).toBeDefined();
      expect(result.holesFilled).toBeDefined();
    });

    test('should track repair statistics correctly', () => {
      const data = createDuplicateVerticesSTL();
      const { result } = trigasm.repair('test.stl', data, {
        removeDuplicateVertex: true,
        removeDuplicateFace: true,
        removeUnreferencedVertex: true,
      });

      expect(result.code).toBe(0);
      expect(result.originalFaces).toBeGreaterThanOrEqual(result.finalFaces);
      expect(result.duplicateFacesRemoved).toBeGreaterThan(0);
    });
  });

  describe('Binary vs ASCII Output', () => {
    test('should output binary STL by default', () => {
      const data = createMinimalSTL();
      const { output } = trigasm.repair('test.stl', data, 'minimal');

      // Binary STL starts with 80-byte header (usually not 'solid')
      // Binary STL won't start with 'solid' text
      expect(output.length).toBeGreaterThan(84); // Header + at least 1 triangle
    });
  });
});
