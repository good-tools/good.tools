/**
 * Trigasm - WebAssembly STL Mesh Repair Library
 * 
 * Core mesh repair implementation using VCGlib
 * 
 * SPDX-License-Identifier: GPL-3.0
 */

#include "mesh_types.h"
#include <string>
#include <emscripten/val.h>

/**
 * Repair options - controls which repair operations to run
 */
struct RepairOptions {
    // Core repairs (default: true)
    bool removeDuplicateVertex = true;
    bool removeDuplicateFace = true;
    bool removeUnreferencedVertex = true;
    bool removeDegenerateFace = true;

    // Hole filling (default: false)
    bool fillHoles = false;
    int maxHoleSize = 100;

    // Manifold repairs (default: false)
    bool removeNonManifoldFace = false;
    bool removeNonManifoldVertex = false;

    // Normal/orientation fixes (default: false)
    bool fixNormalOrientation = false;
    bool flipNormalsOutside = false;

    // Advanced repairs (default: false)
    bool removeTVertexByFlip = false;
    bool removeFaceFoldByFlip = false;

    // Output format (default: true for binary)
    bool binaryOutput = true;
};

/**
 * Result of a repair operation
 */
struct RepairResult {
    int code = 0;  // 0 = success, non-zero = error
    std::string error;

    // Before/after statistics
    int originalVertices = 0;
    int originalFaces = 0;
    int finalVertices = 0;
    int finalFaces = 0;

    // Counts of repairs performed
    int duplicateVerticesRemoved = 0;
    int duplicateFacesRemoved = 0;
    int unreferencedVerticesRemoved = 0;
    int degenerateFacesRemoved = 0;
    int nonManifoldFacesRemoved = 0;
    int nonManifoldVerticesRemoved = 0;
    int holesFilled = 0;
};

/**
 * Progress callback type
 * Receives: step name, progress (0.0 - 1.0)
 */
using ProgressCallback = emscripten::val;

/**
 * Report progress to JS callback if provided
 */
inline void reportProgress(const ProgressCallback& callback, const std::string& step, float progress) {
    if (!callback.isUndefined() && !callback.isNull()) {
        callback(step, progress);
    }
}

/**
 * Repair session - handles loading, repairing, and exporting a mesh
 */
class RepairSession {
private:
    std::string inputPath;
    std::string outputPath;
    TrigasmMesh mesh;
    bool loaded = false;

public:
    /**
     * Create a new repair session for a file
     */
    explicit RepairSession(const std::string& path) : inputPath(path) {}

    /**
     * Perform mesh repair with given options
     * 
     * @param opts Repair options
     * @param outPath Output file path
     * @param callback Optional progress callback
     * @return RepairResult with statistics
     */
    RepairResult repair(const RepairOptions& opts, const std::string& outPath, ProgressCallback callback = emscripten::val::undefined()) {
        RepairResult result;
        outputPath = outPath;

        // Step 1: Load the STL file
        reportProgress(callback, "loading", 0.0f);
        
        int loadMask = 0;
        int err = vcg::tri::io::ImporterSTL<TrigasmMesh>::Open(mesh, inputPath.c_str(), loadMask);
        
        if (err != 0) {
            result.code = 1;
            result.error = vcg::tri::io::ImporterSTL<TrigasmMesh>::ErrorMsg(err);
            return result;
        }
        
        loaded = true;
        result.originalVertices = mesh.VN();
        result.originalFaces = mesh.FN();
        
        reportProgress(callback, "loading", 1.0f);

        // Step 2: Remove duplicate vertices
        if (opts.removeDuplicateVertex) {
            reportProgress(callback, "removeDuplicateVertex", 0.0f);
            result.duplicateVerticesRemoved = vcg::tri::Clean<TrigasmMesh>::RemoveDuplicateVertex(mesh, false);
            reportProgress(callback, "removeDuplicateVertex", 1.0f);
        }

        // Step 3: Remove duplicate faces
        if (opts.removeDuplicateFace) {
            reportProgress(callback, "removeDuplicateFace", 0.0f);
            result.duplicateFacesRemoved = vcg::tri::Clean<TrigasmMesh>::RemoveDuplicateFace(mesh);
            reportProgress(callback, "removeDuplicateFace", 1.0f);
        }

        // Step 4: Remove degenerate faces
        if (opts.removeDegenerateFace) {
            reportProgress(callback, "removeDegenerateFace", 0.0f);
            result.degenerateFacesRemoved = vcg::tri::Clean<TrigasmMesh>::RemoveDegenerateFace(mesh);
            reportProgress(callback, "removeDegenerateFace", 1.0f);
        }

        // Step 5: Remove unreferenced vertices
        if (opts.removeUnreferencedVertex) {
            reportProgress(callback, "removeUnreferencedVertex", 0.0f);
            result.unreferencedVerticesRemoved = vcg::tri::Clean<TrigasmMesh>::RemoveUnreferencedVertex(mesh);
            reportProgress(callback, "removeUnreferencedVertex", 1.0f);
        }

        // Build topology if needed for advanced repairs
        bool needsFFAdj = opts.removeNonManifoldFace || opts.removeNonManifoldVertex || 
                          opts.fillHoles || opts.fixNormalOrientation || 
                          opts.removeTVertexByFlip || opts.removeFaceFoldByFlip;
        
        if (needsFFAdj) {
            vcg::tri::UpdateTopology<TrigasmMesh>::FaceFace(mesh);
        }

        // Step 6: Remove non-manifold faces
        if (opts.removeNonManifoldFace) {
            reportProgress(callback, "removeNonManifoldFace", 0.0f);
            result.nonManifoldFacesRemoved = vcg::tri::Clean<TrigasmMesh>::RemoveNonManifoldFace(mesh);
            reportProgress(callback, "removeNonManifoldFace", 1.0f);
        }

        // Step 7: Remove non-manifold vertices
        if (opts.removeNonManifoldVertex) {
            reportProgress(callback, "removeNonManifoldVertex", 0.0f);
            result.nonManifoldVerticesRemoved = vcg::tri::Clean<TrigasmMesh>::RemoveNonManifoldVertex(mesh);
            reportProgress(callback, "removeNonManifoldVertex", 1.0f);
        }

        // Rebuild topology after manifold repairs
        if (opts.removeNonManifoldFace || opts.removeNonManifoldVertex) {
            vcg::tri::UpdateTopology<TrigasmMesh>::FaceFace(mesh);
        }

        // Step 8: Fill holes
        if (opts.fillHoles) {
            reportProgress(callback, "fillHoles", 0.0f);
            result.holesFilled = vcg::tri::Hole<TrigasmMesh>::EarCuttingFill<vcg::tri::MinimumWeightEar<TrigasmMesh>>(
                mesh, opts.maxHoleSize, false);
            reportProgress(callback, "fillHoles", 1.0f);
        }

        // Step 9: Fix normal orientation (make coherent)
        if (opts.fixNormalOrientation) {
            reportProgress(callback, "fixNormalOrientation", 0.0f);
            bool isOriented, isOrientable;
            vcg::tri::Clean<TrigasmMesh>::OrientCoherentlyMesh(mesh, isOriented, isOrientable);
            reportProgress(callback, "fixNormalOrientation", 1.0f);
        }

        // Step 10: Flip normals to point outside
        if (opts.flipNormalsOutside) {
            reportProgress(callback, "flipNormalsOutside", 0.0f);
            vcg::tri::Clean<TrigasmMesh>::FlipNormalOutside(mesh);
            reportProgress(callback, "flipNormalsOutside", 1.0f);
        }

        // Step 11: Remove T-vertices by edge flip
        if (opts.removeTVertexByFlip) {
            reportProgress(callback, "removeTVertexByFlip", 0.0f);
            vcg::tri::UpdateTopology<TrigasmMesh>::FaceFace(mesh);
            vcg::tri::Clean<TrigasmMesh>::RemoveTVertexByFlip(mesh);
            reportProgress(callback, "removeTVertexByFlip", 1.0f);
        }

        // Step 12: Remove face folds by edge flip
        if (opts.removeFaceFoldByFlip) {
            reportProgress(callback, "removeFaceFoldByFlip", 0.0f);
            vcg::tri::UpdateTopology<TrigasmMesh>::FaceFace(mesh);
            vcg::tri::Clean<TrigasmMesh>::RemoveFaceFoldByFlip(mesh);
            reportProgress(callback, "removeFaceFoldByFlip", 1.0f);
        }

        // Compact the mesh (remove deleted elements)
        vcg::tri::Allocator<TrigasmMesh>::CompactFaceVector(mesh);
        vcg::tri::Allocator<TrigasmMesh>::CompactVertexVector(mesh);

        // Update normals before export
        vcg::tri::UpdateNormal<TrigasmMesh>::PerVertexNormalizedPerFaceNormalized(mesh);

        // Record final statistics
        result.finalVertices = mesh.VN();
        result.finalFaces = mesh.FN();

        // Step 13: Export the repaired mesh
        reportProgress(callback, "exporting", 0.0f);
        
        int exportErr = vcg::tri::io::ExporterSTL<TrigasmMesh>::Save(
            mesh, 
            outputPath.c_str(), 
            opts.binaryOutput
        );
        
        if (exportErr != 0) {
            result.code = 2;
            result.error = vcg::tri::io::ExporterSTL<TrigasmMesh>::ErrorMsg(exportErr);
            return result;
        }
        
        reportProgress(callback, "exporting", 1.0f);

        result.code = 0;
        return result;
    }

    /**
     * Get the output file path
     */
    std::string getOutputPath() const {
        return outputPath;
    }
};
