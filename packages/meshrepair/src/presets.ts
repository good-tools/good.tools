/**
 * Trigasm - WebAssembly STL Mesh Repair Library
 *
 * Repair presets for common use cases
 *
 * SPDX-License-Identifier: GPL-3.0
 */

import type { RepairOptions, PresetName } from './types';

/**
 * Predefined repair presets for common use cases
 */
export const PRESETS: Record<PresetName, RepairOptions> = {
  /**
   * Minimal repairs - only remove duplicates and degenerate geometry
   * Fast and safe for most meshes
   */
  minimal: {
    removeDuplicateVertex: true,
    removeDuplicateFace: true,
    removeUnreferencedVertex: true,
    removeDegenerateFace: true,
    fillHoles: false,
    maxHoleSize: 100,
    removeNonManifoldFace: false,
    removeNonManifoldVertex: false,
    fixNormalOrientation: false,
    flipNormalsOutside: false,
    removeTVertexByFlip: false,
    removeFaceFoldByFlip: false,
    binaryOutput: true,
  },

  /**
   * Print-ready - optimized for 3D printing
   * Fills holes, fixes normals, ensures watertight mesh
   */
  'print-ready': {
    removeDuplicateVertex: true,
    removeDuplicateFace: true,
    removeUnreferencedVertex: true,
    removeDegenerateFace: true,
    fillHoles: true,
    maxHoleSize: 100,
    removeNonManifoldFace: false,
    removeNonManifoldVertex: false,
    fixNormalOrientation: true,
    flipNormalsOutside: true,
    removeTVertexByFlip: false,
    removeFaceFoldByFlip: false,
    binaryOutput: true,
  },

  /**
   * Aggressive - all repairs enabled
   * Maximum cleanup, may modify mesh significantly
   */
  aggressive: {
    removeDuplicateVertex: true,
    removeDuplicateFace: true,
    removeUnreferencedVertex: true,
    removeDegenerateFace: true,
    fillHoles: true,
    maxHoleSize: 1000,
    removeNonManifoldFace: true,
    removeNonManifoldVertex: true,
    fixNormalOrientation: true,
    flipNormalsOutside: true,
    removeTVertexByFlip: true,
    removeFaceFoldByFlip: true,
    binaryOutput: true,
  },
} as const;

/**
 * Get repair options from a preset name or options object
 */
export function resolveOptions(
  optionsOrPreset: RepairOptions | PresetName | undefined
): RepairOptions {
  if (optionsOrPreset === undefined) {
    return { ...PRESETS.minimal };
  }

  if (typeof optionsOrPreset === 'string') {
    const preset = PRESETS[optionsOrPreset];
    if (!preset) {
      throw new Error(`Unknown preset: ${optionsOrPreset}`);
    }
    return { ...preset };
  }

  // Merge with minimal defaults
  return { ...PRESETS.minimal, ...optionsOrPreset };
}
