/**
 * Trigasm - WebAssembly STL Mesh Repair Library
 * 
 * Mesh type definitions using VCGlib
 * 
 * SPDX-License-Identifier: GPL-3.0
 */

#ifndef TRIGASM_MESH_TYPES_H
#define TRIGASM_MESH_TYPES_H

#include <vcg/complex/complex.h>
#include <vcg/complex/algorithms/clean.h>
#include <vcg/complex/algorithms/hole.h>
#include <vcg/complex/algorithms/update/topology.h>
#include <vcg/complex/algorithms/update/normal.h>
#include <vcg/complex/algorithms/update/flag.h>
#include <vcg/complex/algorithms/update/selection.h>
#include <wrap/io_trimesh/import_stl.h>
#include <wrap/io_trimesh/export_stl.h>

// Forward declarations
class TrigasmVertex;
class TrigasmEdge;
class TrigasmFace;

/**
 * UsedTypes declaration for VCG mesh
 */
struct TrigasmUsedTypes : public vcg::UsedTypes<
    vcg::Use<TrigasmVertex>::AsVertexType,
    vcg::Use<TrigasmEdge>::AsEdgeType,
    vcg::Use<TrigasmFace>::AsFaceType> {};

/**
 * Vertex type with required components for mesh repair
 */
class TrigasmVertex : public vcg::Vertex<TrigasmUsedTypes,
    vcg::vertex::Coord3f,      // 3D coordinates (float)
    vcg::vertex::Normal3f,     // Normal vector
    vcg::vertex::BitFlags,     // Status flags
    vcg::vertex::VFAdj,        // Vertex-Face adjacency
    vcg::vertex::Mark          // Marking for algorithms
> {};

/**
 * Face type with required components for mesh repair
 */
class TrigasmFace : public vcg::Face<TrigasmUsedTypes,
    vcg::face::VertexRef,      // References to vertices
    vcg::face::Normal3f,       // Face normal
    vcg::face::BitFlags,       // Status flags
    vcg::face::FFAdj,          // Face-Face adjacency
    vcg::face::VFAdj,          // Vertex-Face adjacency (for VF iteration)
    vcg::face::Mark            // Marking for algorithms
> {};

/**
 * Edge type (minimal, used for some algorithms)
 */
class TrigasmEdge : public vcg::Edge<TrigasmUsedTypes> {};

/**
 * The main mesh type used throughout Trigasm
 */
class TrigasmMesh : public vcg::tri::TriMesh<
    std::vector<TrigasmVertex>,
    std::vector<TrigasmFace>,
    std::vector<TrigasmEdge>
> {};

#endif // TRIGASM_MESH_TYPES_H
