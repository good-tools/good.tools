import type * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { describe, expect, it } from 'vitest'
import { cadFormat, cadStats, flattenTree, fromOcct, type OcctResult, toStl, toThreeMesh } from './cad'

// A unit-square plate (two triangles) offset by `x`, in occt-import-js's output shape
const plate = (name: string, x: number, color?: [number, number, number]) => ({
  name,
  color,
  brep_faces: [{ first: 0, last: 1, color: null }],
  attributes: { position: { array: [x, 0, 0, x + 1, 0, 0, x + 1, 2, 0, x, 2, 0] } },
  index: { array: [0, 1, 2, 0, 2, 3] },
})

const result: OcctResult = {
  success: true,
  root: {
    name: '',
    meshes: [],
    children: [
      {
        name: 'assembly',
        meshes: [],
        children: [
          { name: 'bolt', meshes: [0], children: [] },
          { name: 'pair', meshes: [1, 2], children: [] },
        ],
      },
      { name: 'empty', meshes: [], children: [] },
    ],
  },
  meshes: [plate('bolt', 0, [1, 0, 0]), plate('', 2), plate('nut', 4)],
}

describe('cad', () => {
  it('detects the format from the extension', () => {
    expect(cadFormat('Part.STP')).toBe('step')
    expect(cadFormat('a.b.iges')).toBe('iges')
    expect(cadFormat('x.brep')).toBe('brep')
    expect(cadFormat('x.stl')).toBeNull()
  })

  it('flattens the part tree, dropping empty branches', () => {
    const rows = flattenTree(fromOcct(result))
    expect(rows.map((r) => [r.depth, r.name, r.meshes])).toEqual([
      [0, 'assembly', [0, 1, 2]],
      [1, 'bolt', [0]],
      [1, 'pair', [1, 2]],
      [2, 'Part 2', [1]],
      [2, 'nut', [2]],
    ])
  })

  it('lists parts of a flat file (BREP) at the top level', () => {
    const rows = flattenTree(fromOcct({ ...result, root: { name: '', meshes: [0, 1], children: [] } }))
    expect(rows.map((r) => r.name)).toEqual(['bolt', 'Part 2'])
  })

  it('counts triangles and measures the bounding box', () => {
    const { meshes } = fromOcct(result)
    const stats = cadStats(meshes)
    expect(stats.parts).toBe(3)
    expect(stats.triangles).toBe(6)
    expect(stats.size?.toArray()).toEqual([5, 2, 0])
    expect(cadStats([]).size).toBeNull()
  })

  it('uses face colours over the part colour', () => {
    const m = fromOcct(result).meshes[0]
    if (!m) throw new Error('no mesh')
    expect((toThreeMesh(m).material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff0000')
    m.faces = [
      { first: 0, last: 0, color: [0, 0, 1] },
      { first: 1, last: 1, color: null },
    ]
    const mesh = toThreeMesh(m)
    expect(mesh.geometry.groups).toEqual([
      { start: 0, count: 3, materialIndex: 0 },
      { start: 3, count: 3, materialIndex: 1 },
    ])
    expect((mesh.material as THREE.MeshStandardMaterial[]).map((x) => x.color.getHexString())).toEqual([
      '0000ff',
      'ff0000',
    ])
  })

  it('exports binary STL that reads back', async () => {
    const meshes = fromOcct(result).meshes.map(toThreeMesh)
    const stl = await toStl(meshes)
    expect(stl.byteLength).toBe(84 + 6 * 50)
    const geometry = new STLLoader().parse(stl.slice().buffer)
    expect(geometry.getAttribute('position').count).toBe(18)
  })
})
