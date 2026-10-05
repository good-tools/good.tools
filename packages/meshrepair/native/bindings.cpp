/**
 * MeshRepair - WebAssembly STL Mesh Repair Library
 * 
 * Emscripten/Embind bindings for JavaScript interop
 * 
 * SPDX-License-Identifier: GPL-3.0
 */

#include <emscripten/bind.h>
#include "meshrepair.cpp"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(meshrepair) {
    // Bind RepairOptions struct
    value_object<RepairOptions>("RepairOptions")
        .field("removeDuplicateVertex", &RepairOptions::removeDuplicateVertex)
        .field("removeDuplicateFace", &RepairOptions::removeDuplicateFace)
        .field("removeUnreferencedVertex", &RepairOptions::removeUnreferencedVertex)
        .field("removeDegenerateFace", &RepairOptions::removeDegenerateFace)
        .field("fillHoles", &RepairOptions::fillHoles)
        .field("maxHoleSize", &RepairOptions::maxHoleSize)
        .field("removeNonManifoldFace", &RepairOptions::removeNonManifoldFace)
        .field("removeNonManifoldVertex", &RepairOptions::removeNonManifoldVertex)
        .field("fixNormalOrientation", &RepairOptions::fixNormalOrientation)
        .field("flipNormalsOutside", &RepairOptions::flipNormalsOutside)
        .field("removeTVertexByFlip", &RepairOptions::removeTVertexByFlip)
        .field("removeFaceFoldByFlip", &RepairOptions::removeFaceFoldByFlip)
        .field("binaryOutput", &RepairOptions::binaryOutput);

    // Bind RepairResult struct
    value_object<RepairResult>("RepairResult")
        .field("code", &RepairResult::code)
        .field("error", &RepairResult::error)
        .field("originalVertices", &RepairResult::originalVertices)
        .field("originalFaces", &RepairResult::originalFaces)
        .field("finalVertices", &RepairResult::finalVertices)
        .field("finalFaces", &RepairResult::finalFaces)
        .field("duplicateVerticesRemoved", &RepairResult::duplicateVerticesRemoved)
        .field("duplicateFacesRemoved", &RepairResult::duplicateFacesRemoved)
        .field("unreferencedVerticesRemoved", &RepairResult::unreferencedVerticesRemoved)
        .field("degenerateFacesRemoved", &RepairResult::degenerateFacesRemoved)
        .field("nonManifoldFacesRemoved", &RepairResult::nonManifoldFacesRemoved)
        .field("nonManifoldVerticesRemoved", &RepairResult::nonManifoldVerticesRemoved)
        .field("holesFilled", &RepairResult::holesFilled);

    // Bind RepairSession class
    class_<RepairSession>("RepairSession")
        .constructor<const std::string&>()
        .function("repair", &RepairSession::repair)
        .function("getOutputPath", &RepairSession::getOutputPath);
}
