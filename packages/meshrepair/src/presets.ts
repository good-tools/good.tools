/**
 * MeshRepair - WebAssembly STL Mesh Repair Library
 *
 * Preset configurations for common repair operations
 *
 * SPDX-License-Identifier: GPL-3.0
 */

import type { PresetName, RepairOptions } from './types'

/**
 * Preset configurations for common repair operations
 */
export const PRESETS: Record<PresetName, Required<RepairOptions>> = {
  /**
   * Minimal repair - just remove duplicates and degenerate geometry
   * Best for cleaning up already-good models
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
   * Print-ready - recommended for 3D printing
   * Fills holes and fixes normals for watertight manifold output
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
   * Use when other presets fail to produce a valid mesh
   */
  aggressive: {
    removeDuplicateVertex: true,
    removeDuplicateFace: true,
    removeUnreferencedVertex: true,
    removeDegenerateFace: true,
    fillHoles: true,
    maxHoleSize: 200,
    removeNonManifoldFace: true,
    removeNonManifoldVertex: true,
    fixNormalOrientation: true,
    flipNormalsOutside: true,
    removeTVertexByFlip: true,
    removeFaceFoldByFlip: true,
    binaryOutput: true,
  },
}

/**
 * Resolve options - merge preset with custom options
 */
export function resolveOptions(options?: RepairOptions | PresetName): Required<RepairOptions> {
  if (!options) {
    return PRESETS.minimal
  }

  if (typeof options === 'string') {
    return PRESETS[options]
  }

  // Merge with minimal preset for defaults
  return {
    ...PRESETS.minimal,
    ...options,
  }
}
