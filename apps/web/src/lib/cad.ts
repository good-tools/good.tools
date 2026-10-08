import * as THREE from 'three'

export type CadFormat = 'step' | 'iges' | 'brep'
type RGB = [number, number, number]

const FORMATS: Record<string, CadFormat> = { step: 'step', stp: 'step', iges: 'iges', igs: 'iges', brep: 'brep' }
export const CAD_ACCEPT = Object.keys(FORMATS)
  .map((e) => `.${e}`)
  .join(',')

/** occt-import-js format name from a file name, or null if it isn't a supported CAD file. */
export function cadFormat(name: string): CadFormat | null {
  return FORMATS[name.toLowerCase().split('.').pop() ?? ''] ?? null
}

export interface CadMesh {
  name: string
  /** 0–1 RGB from the file */
  color?: RGB
  /** Triangle ranges of the source B-rep faces, with their own colour when the file sets one */
  faces: { first: number; last: number; color: RGB | null }[]
  position: Float32Array
  normal?: Float32Array
  index: Uint32Array
}
export interface CadNode {
  name: string
  meshes: number[]
  children: CadNode[]
}
export interface CadModel {
  root: CadNode
  meshes: CadMesh[]
}

/** The shape occt-import-js returns (plain JS arrays) */
export interface OcctResult {
  success: boolean
  root: CadNode
  meshes: {
    name: string
    color?: RGB
    brep_faces: { first: number; last: number; color: RGB | null }[]
    attributes: { position: { array: number[] }; normal?: { array: number[] } }
    index: { array: number[] }
  }[]
}

/** Typed arrays so the model can be transferred out of the worker and fed straight to three.js. */
export function fromOcct(r: OcctResult): CadModel {
  return {
    root: r.root,
    meshes: r.meshes.map((m) => ({
      name: m.name ?? '',
      color: m.color,
      faces: m.brep_faces ?? [],
      position: new Float32Array(m.attributes.position.array),
      normal: m.attributes.normal && new Float32Array(m.attributes.normal.array),
      index: new Uint32Array(m.index.array),
    })),
  }
}

export interface TreeRow {
  key: string
  depth: number
  name: string
  /** Every mesh at or below this row */
  meshes: number[]
}

const allMeshes = (n: CadNode): number[] => [...n.meshes, ...n.children.flatMap(allMeshes)]

/** Part tree as indented rows: assemblies, then their parts. Empty branches are dropped. */
export function flattenTree(model: CadModel): TreeRow[] {
  const rows: TreeRow[] = []
  const meshRows = (ids: number[], depth: number, key: string) => {
    for (const i of ids)
      rows.push({ key: `${key}/m${i}`, depth, name: model.meshes[i]?.name || `Part ${i + 1}`, meshes: [i] })
  }
  const walk = (node: CadNode, depth: number, key: string) => {
    const meshes = allMeshes(node)
    if (!meshes.length) return
    rows.push({ key, depth, name: node.name || 'Unnamed', meshes })
    // A node that is exactly one part needs no extra row for it
    if (node.meshes.length > 1 || node.children.length) meshRows(node.meshes, depth + 1, key)
    node.children.forEach((c, i) => {
      walk(c, depth + 1, `${key}/${i}`)
    })
  }
  // The root is an unnamed container: list its parts and children at the top level
  meshRows(model.root.meshes, 0, 'r')
  model.root.children.forEach((c, i) => {
    walk(c, 0, `r/${i}`)
  })
  return rows
}

export interface CadStats {
  parts: number
  triangles: number
  /** Bounding box size, or null for an empty model */
  size: THREE.Vector3 | null
}

export function cadStats(meshes: CadMesh[]): CadStats {
  const box = new THREE.Box3()
  const p = new THREE.Vector3()
  let triangles = 0
  for (const { position, index } of meshes) {
    triangles += index.length / 3
    for (let j = 0; j < position.length; j += 3) box.expandByPoint(p.fromArray(position, j))
  }
  return { parts: meshes.length, triangles, size: box.isEmpty() ? null : box.getSize(new THREE.Vector3()) }
}

const DEFAULT_COLOR = new THREE.Color('#a1a1aa')
const toColor = (c?: RGB | null) => (c ? new THREE.Color().setRGB(c[0], c[1], c[2]) : undefined)
const material = (color: THREE.Color) =>
  new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.6 })

/** A three.js mesh coloured like the file: the part colour, overridden per B-rep face where set. */
export function toThreeMesh(m: CadMesh): THREE.Mesh {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(m.position, 3))
  if (m.normal) geometry.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3))
  else geometry.computeVertexNormals()
  geometry.setIndex(new THREE.BufferAttribute(m.index, 1))

  const base = toColor(m.color) ?? DEFAULT_COLOR
  if (!m.faces.some((f) => f.color)) {
    const mesh = new THREE.Mesh(geometry, material(base))
    mesh.name = m.name
    return mesh
  }
  // One material per distinct colour, one draw group per face
  const materials: THREE.MeshStandardMaterial[] = []
  const byHex = new Map<string, number>()
  for (const f of m.faces) {
    const c = toColor(f.color) ?? base
    const hex = c.getHexString()
    if (!byHex.has(hex)) byHex.set(hex, materials.push(material(c)) - 1)
    geometry.addGroup(f.first * 3, (f.last - f.first + 1) * 3, byHex.get(hex))
  }
  const mesh = new THREE.Mesh(geometry, materials)
  mesh.name = m.name
  return mesh
}

export function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose()
  for (const m of [mesh.material].flat()) m.dispose()
}

const group = (meshes: THREE.Mesh[], scale = 1) => {
  const g = new THREE.Group()
  // clone() shares geometry and materials; adding the originals would take them out of the live scene
  g.add(...meshes.map((m) => m.clone()))
  g.scale.setScalar(scale)
  g.updateMatrixWorld(true)
  return g
}

/** Binary STL, in the file's units (millimetres for STEP and IGES). */
export async function toStl(meshes: THREE.Mesh[]): Promise<Uint8Array<ArrayBuffer>> {
  const { STLExporter } = await import('three/addons/exporters/STLExporter.js')
  const view = new STLExporter().parse(group(meshes), { binary: true })
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
}

/** Binary glTF. glTF is in metres, so millimetres are scaled by 1/1000. */
export async function toGlb(meshes: THREE.Mesh[]): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
  return (await new GLTFExporter().parseAsync(group(meshes, 0.001), { binary: true })) as ArrayBuffer
}
