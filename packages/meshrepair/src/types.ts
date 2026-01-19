/**
 * MeshRepair - WebAssembly STL Mesh Repair Library
 *
 * TypeScript type definitions
 *
 * SPDX-License-Identifier: GPL-3.0
 */

/**
 * Repair options - controls which repair operations to run
 */
export interface RepairOptions {
  /** Remove vertices at the same position (default: true) */
  removeDuplicateVertex?: boolean;

  /** Remove faces with identical vertex references (default: true) */
  removeDuplicateFace?: boolean;

  /** Remove vertices not referenced by any face (default: true) */
  removeUnreferencedVertex?: boolean;

  /** Remove faces with zero area or repeated vertices (default: true) */
  removeDegenerateFace?: boolean;

  /** Fill holes in the mesh (default: false) */
  fillHoles?: boolean;

  /** Maximum hole size to fill (edges in boundary) (default: 100) */
  maxHoleSize?: number;

  /** Remove non-manifold faces (more than 2 faces per edge) (default: false) */
  removeNonManifoldFace?: boolean;

  /** Remove non-manifold vertices (default: false) */
  removeNonManifoldVertex?: boolean;

  /** Make face orientations consistent (default: false) */
  fixNormalOrientation?: boolean;

  /** Flip normals to point outward (default: false) */
  flipNormalsOutside?: boolean;

  /** Remove T-vertices by edge flipping (default: false) */
  removeTVertexByFlip?: boolean;

  /** Remove face folds by edge flipping (default: false) */
  removeFaceFoldByFlip?: boolean;

  /** Output binary STL (true) or ASCII STL (false) (default: true) */
  binaryOutput?: boolean;
}

/**
 * Result of a repair operation
 */
export interface RepairResult {
  /** 0 = success, non-zero = error */
  code: number;

  /** Error message if code != 0 */
  error?: string;

  /** Number of vertices before repair */
  originalVertices: number;

  /** Number of faces before repair */
  originalFaces: number;

  /** Number of vertices after repair */
  finalVertices: number;

  /** Number of faces after repair */
  finalFaces: number;

  /** Number of duplicate vertices removed */
  duplicateVerticesRemoved: number;

  /** Number of duplicate faces removed */
  duplicateFacesRemoved: number;

  /** Number of unreferenced vertices removed */
  unreferencedVerticesRemoved: number;

  /** Number of degenerate faces removed */
  degenerateFacesRemoved: number;

  /** Number of non-manifold faces removed */
  nonManifoldFacesRemoved: number;

  /** Number of non-manifold vertices removed */
  nonManifoldVerticesRemoved: number;

  /** Number of holes filled */
  holesFilled: number;
}

/**
 * Progress callback function type
 * @param step - Current repair step name
 * @param progress - Progress value (0.0 to 1.0)
 */
export type ProgressCallback = (step: string, progress: number) => void;

/**
 * Options for repairFile and repairFileInPlace methods
 */
export interface RepairFileOptions {
  /** Repair options or preset name */
  options?: RepairOptions | PresetName;

  /** Output file path in virtual FS (auto-generated if not provided) */
  outputPath?: string;

  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Available preset names
 */
export type PresetName = 'minimal' | 'print-ready' | 'aggressive';

/**
 * Emscripten FS interface (subset used by MeshRepair)
 */
export interface EmscriptenFS {
  writeFile(path: string, data: string | ArrayBufferView, opts?: { encoding?: string }): void;
  readFile(path: string, opts?: { encoding?: string }): Uint8Array;
  unlink(path: string): void;
  mkdir(path: string): void;
  rmdir(path: string): void;
  readdir(path: string): string[];
  stat(path: string): { mode: number };
  isDir(mode: number): boolean;
}

/**
 * Internal: RepairSession instance from WASM module
 */
export interface RepairSessionInstance {
  repair(options: RepairOptions, outputPath: string, callback?: ProgressCallback): RepairResult;
  getOutputPath(): string;
  delete(): void;
}

/**
 * Internal: MeshRepair WASM module interface
 */
export interface MeshRepairModule {
  FS: EmscriptenFS;
  RepairSession: new (path: string) => RepairSessionInstance;
}

/**
 * Options for initializing MeshRepair
 */
export interface InitOptions {
  /**
   * Custom function to locate WASM/data files
   * @param path - Filename being requested
   * @param prefix - Default prefix path
   * @returns Full path to the file
   */
  locateFile?: (path: string, prefix: string) => string;
}

/**
 * Type of the function that loads the MeshRepair WASM module
 */
export type MeshRepairLoader = (options?: InitOptions) => Promise<MeshRepairModule>;
