/**
 * MeshRepair - WebAssembly STL Mesh Repair Library
 * 
 * Mesh type definitions using VCGlib
 * 
 * SPDX-License-Identifier: GPL-3.0
 */

#ifndef MESHREPAIR_MESH_TYPES_H
#define MESHREPAIR_MESH_TYPES_H

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
class MeshRepairVertex;
class MeshRepairEdge;
class MeshRepairFace;

/**
 * UsedTypes declaration for VCG mesh
 */
struct MeshRepairUsedTypes : public vcg::UsedTypes<
    vcg::Use<MeshRepairVertex>::AsVertexType,
    vcg::Use<MeshRepairEdge>::AsEdgeType,
    vcg::Use<MeshRepairFace>::AsFaceType> {};

/**
 * Vertex type with required components for mesh repair
 */
class MeshRepairVertex : public vcg::Vertex<MeshRepairUsedTypes,
    vcg::vertex::Coord3f,      // 3D coordinates (float)
    vcg::vertex::Normal3f,     // Normal vector
    vcg::vertex::BitFlags,     // Status flags
    vcg::vertex::VFAdj,        // Vertex-Face adjacency
    vcg::vertex::Mark          // Marking for algorithms
> {};

/**
 * Face type with required components for mesh repair
 */
class MeshRepairFace : public vcg::Face<MeshRepairUsedTypes,
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
class MeshRepairEdge : public vcg::Edge<MeshRepairUsedTypes> {};

/**
 * The main mesh type used throughout MeshRepair
 */
class MeshRepairMesh : public vcg::tri::TriMesh<
    std::vector<MeshRepairVertex>,
    std::vector<MeshRepairFace>,
    std::vector<MeshRepairEdge>
> {};

#endif // MESHREPAIR_MESH_TYPES_H
