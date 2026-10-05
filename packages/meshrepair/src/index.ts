/**
 * MeshRepair - WebAssembly STL Mesh Repair Library
 *
 * Main TypeScript wrapper class
 *
 * SPDX-License-Identifier: GPL-3.0
 */

import { resolveOptions } from './presets'
import type {
  EmscriptenFS,
  InitOptions,
  MeshRepairLoader,
  MeshRepairModule,
  PresetName,
  ProgressCallback,
  RepairFileOptions,
  RepairOptions,
  RepairResult,
} from './types'

export { PRESETS } from './presets'
// Re-export types and presets
export * from './types'

/**
 * MeshRepair - WebAssembly STL Mesh Repair Library
 *
 * A lightweight, headless port of VCGlib for automated repair
 * and sanitization of STL files in the browser.
 *
 * @example
 * ```typescript
 * import { MeshRepair } from '@goodtools/meshrepair';
 * import loadMeshRepair from '@goodtools/meshrepair/wasm';
 *
 * const meshrepair = await MeshRepair.init(loadMeshRepair);
 * const { result, output } = meshrepair.repair('model.stl', stlData, 'print-ready');
 * console.log(`Repaired: ${result.holesFilled} holes filled`);
 * ```
 */
export class MeshRepair {
  /** Direct access to Emscripten virtual filesystem */
  public readonly FS: EmscriptenFS

  private lib: MeshRepairModule
  private uploadDir = '/uploads'
  private outputDir = '/output'

  /**
   * Initialize MeshRepair WASM module
   *
   * @param loader - Function that loads the WASM module (import from '@goodtools/meshrepair/wasm')
   * @param options - Initialization options
   * @returns Promise resolving to MeshRepair instance
   *
   * @example
   * ```typescript
   * import { MeshRepair } from '@goodtools/meshrepair';
   * import loadMeshRepair from '@goodtools/meshrepair/wasm';
   *
   * const meshrepair = await MeshRepair.init(loadMeshRepair);
   *
   * // With custom WASM location
   * const meshrepair = await MeshRepair.init(loadMeshRepair, {
   *   locateFile: (path) => `/assets/${path}`
   * });
   * ```
   */
  static async init(loader: MeshRepairLoader, options?: InitOptions): Promise<MeshRepair> {
    const lib = await loader(options)
    return new MeshRepair(lib)
  }

  private constructor(lib: MeshRepairModule) {
    this.lib = lib
    this.FS = lib.FS

    // Create working directories
    try {
      this.lib.FS.mkdir(this.uploadDir)
    } catch {
      // Directory may already exist
    }
    try {
      this.lib.FS.mkdir(this.outputDir)
    } catch {
      // Directory may already exist
    }
  }

  /**
   * Repair an STL file by passing data directly
   *
   * Convenience method for smaller files. For large files,
   * use `FS.writeFile()` followed by `repairFile()`.
   *
   * @param name - Filename (used for virtual FS path)
   * @param data - STL file data
   * @param options - Repair options or preset name
   * @param onProgress - Optional progress callback
   * @returns Repair result and output buffer
   *
   * @example
   * ```typescript
   * const stlData = await fetch('/model.stl').then(r => r.arrayBuffer());
   * const { result, output } = meshrepair.repair('model.stl', new Uint8Array(stlData), 'print-ready');
   * ```
   */
  repair(
    name: string,
    data: string | ArrayBufferView,
    options?: RepairOptions | PresetName,
    onProgress?: ProgressCallback,
  ): { result: RepairResult; output: Uint8Array } {
    const inputPath = `${this.uploadDir}/${name}`
    this.lib.FS.writeFile(inputPath, data)

    try {
      const response = this.repairFile(inputPath, {
        options,
        onProgress,
      })
      return { result: response.result, output: response.output }
    } finally {
      // Cleanup input file
      try {
        this.lib.FS.unlink(inputPath)
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Repair an STL file from a path in the virtual filesystem
   *
   * Use this for large files - write with `FS.writeFile()` first.
   *
   * @param inputPath - Path to STL file in virtual FS
   * @param options - Repair options
   * @returns Repair result, output buffer, and output path
   *
   * @example
   * ```typescript
   * // Write large file directly to FS
   * meshrepair.FS.writeFile('/uploads/huge.stl', hugeBuffer);
   *
   * // Repair by path
   * const { result, output } = meshrepair.repairFile('/uploads/huge.stl', {
   *   options: 'print-ready',
   *   onProgress: (step, p) => console.log(`${step}: ${p * 100}%`)
   * });
   * ```
   */
  repairFile(
    inputPath: string,
    options?: RepairFileOptions,
  ): { result: RepairResult; output: Uint8Array; outputPath: string } {
    const opts = options ?? {}
    const finalOutputPath = opts.outputPath ?? this.generateOutputPath(inputPath)
    const mergedOptions = resolveOptions(opts.options)

    const session = new this.lib.RepairSession(inputPath)

    try {
      // WASM binding requires a callback function, use no-op if not provided
      const callback = opts.onProgress ?? (() => {})
      const result = session.repair(mergedOptions, finalOutputPath, callback)

      if (result.code !== 0) {
        throw new Error(result.error || `Repair failed with code ${result.code}`)
      }

      const output = this.lib.FS.readFile(finalOutputPath)
      return { result, output, outputPath: finalOutputPath }
    } finally {
      session.delete()
    }
  }

  /**
   * Repair an STL file without reading output back to JavaScript
   *
   * Memory-efficient for large files or when chaining operations.
   * The output file remains in the virtual FS.
   *
   * @param inputPath - Path to STL file in virtual FS
   * @param options - Repair options
   * @returns Repair result and output path
   *
   * @example
   * ```typescript
   * meshrepair.FS.writeFile('/uploads/huge.stl', hugeBuffer);
   *
   * const { result, outputPath } = meshrepair.repairFileInPlace('/uploads/huge.stl', {
   *   options: 'aggressive'
   * });
   *
   * // Read output when needed
   * const repairedData = meshrepair.FS.readFile(outputPath);
   * ```
   */
  repairFileInPlace(inputPath: string, options?: RepairFileOptions): { result: RepairResult; outputPath: string } {
    const opts = options ?? {}
    const finalOutputPath = opts.outputPath ?? this.generateOutputPath(inputPath)
    const mergedOptions = resolveOptions(opts.options)

    const session = new this.lib.RepairSession(inputPath)

    try {
      // WASM binding requires a callback function, use no-op if not provided
      const callback = opts.onProgress ?? (() => {})
      const result = session.repair(mergedOptions, finalOutputPath, callback)

      if (result.code !== 0) {
        throw new Error(result.error || `Repair failed with code ${result.code}`)
      }

      return { result, outputPath: finalOutputPath }
    } finally {
      session.delete()
    }
  }

  /**
   * Clean up resources and remove working directories
   */
  destroy(): void {
    try {
      this.removeDir(this.uploadDir)
    } catch {
      // Ignore cleanup errors
    }
    try {
      this.removeDir(this.outputDir)
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Generate output path from input path
   */
  private generateOutputPath(inputPath: string): string {
    const basename = inputPath.split('/').pop() || 'output'
    const name = basename.replace(/\.stl$/i, '')
    return `${this.outputDir}/${name}_repaired.stl`
  }

  /**
   * Recursively remove a directory
   */
  private removeDir(path: string): void {
    const entries = this.lib.FS.readdir(path)
    for (const entry of entries) {
      if (entry === '.' || entry === '..') continue
      const fullPath = `${path}/${entry}`
      const stat = this.lib.FS.stat(fullPath)
      if (this.lib.FS.isDir(stat.mode)) {
        this.removeDir(fullPath)
      } else {
        this.lib.FS.unlink(fullPath)
      }
    }
    this.lib.FS.rmdir(path)
  }
}

export default MeshRepair
