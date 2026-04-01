import * as createAOMesh from 'ao-mesher'
import type { NdArray } from 'ndarray'
import { oversizedField } from '../../common/voxels/helpers'
import { VoxelSize } from './constants'

const greedyMesher = require('greedy-mesher')({
  extraArgs: 2,
  order: [2, 1, 0],
  merge: () => true,
  append: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, val: any, result: MesherOutput) => {
    result.push([
      [x1, y1, z1],
      [x2, y2, z2],
    ])
  },
})

type MesherOutput = [[x1: number, y1: number, z1: number], [x2: number, y2: number, z2: number]][]

export { VoxelSize }

type MeshData = {
  opaquePositions: Float32Array
  opaqueIndices: Uint32Array
  opaqueNormals: Float32Array
  ambientOcclusion: Float32Array
  opaqueTextureIndices: Float32Array
  glassPositions: Float32Array
  glassIndices: Uint32Array
  glassNormals: Float32Array
  colliderPositions: Float32Array
  colliderIndices: Uint32Array
  colliderNormals: Float32Array
}

// The 0.25 is to make the boxes aligned on the 0, 0.5 and 1 in each
// dimension, makes picking easier (but it's kind of gross)
const fx = (x: number) => x - 0.25
const fy = (y: number) => y + 0.25
const fz = (z: number) => z - 0.25

// constants to point to the a, b, c points in the vertex data returned by createAOMesh
const a = 0
const ax = a
const ay = a + 1
const az = a + 2
const b = 8
const bx = b
const by = b + 1
const bz = b + 2
const c = 16
const cx = c
const cy = c + 1
const cz = c + 2

// Compute normal from three vertices using cross product
// For voxel geometry, normals are axis-aligned (+/-1 on one axis, 0 on others)
function computeNormal(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): [number, number, number] {
  // Edge vectors
  const e1x = bx - ax
  const e1y = by - ay
  const e1z = bz - az
  const e2x = cx - ax
  const e2y = cy - ay
  const e2z = cz - az

  // Cross product: e1 × e2
  let nx = e1y * e2z - e1z * e2y
  let ny = e1z * e2x - e1x * e2z
  let nz = e1x * e2y - e1y * e2x

  // Normalize
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (length > 0) {
    nx /= length
    ny /= length
    nz /= length
  }

  return [nx, ny, nz]
}

export function setVoxelData(data: Uint8Array, i: number, positions: number[], normals: number[], indices: number[], indexCount: number): number {
  // Extract positions
  const pax = fx(data[ax + i] * VoxelSize)
  const pay = fy(data[ay + i] * VoxelSize)
  const paz = fz(data[az + i] * VoxelSize)
  const pbx = fx(data[bx + i] * VoxelSize)
  const pby = fy(data[by + i] * VoxelSize)
  const pbz = fz(data[bz + i] * VoxelSize)
  const pcx = fx(data[cx + i] * VoxelSize)
  const pcy = fy(data[cy + i] * VoxelSize)
  const pcz = fz(data[cz + i] * VoxelSize)

  positions.push(pax, pay, paz)
  positions.push(pbx, pby, pbz)
  positions.push(pcx, pcy, pcz)

  // Compute normal for this triangle (same normal for all 3 vertices of voxel face)
  const [nx, ny, nz] = computeNormal(pax, pay, paz, pbx, pby, pbz, pcx, pcy, pcz)
  normals.push(nx, ny, nz)
  normals.push(nx, ny, nz)
  normals.push(nx, ny, nz)

  indices.push(indexCount, indexCount + 2, indexCount + 1)

  return 3 // next count for index/element count
}

// @todo, the indices returned from the function doesnt deduplicate vertices, so check the vox-reader.ts for optimisation
export default function mesher(shape: [number, number, number], field: NdArray<Uint16Array>, solidMaterialId?: number): MeshData {
  const oversized = oversizedField(field, solidMaterialId)
  const vertData: Uint8Array | null = createAOMesh(oversized)

  const glassPositions: number[] = []
  const glassNormals: number[] = []
  const glassIndices: number[] = []
  let glassIndexCount = 0

  const ambientOcclusion: number[] = []
  const opaqueTextureIndices = []
  const opaquePositions: number[] = []
  const opaqueNormals: number[] = []
  const opaqueIndices: number[] = []
  let opaqueIndexCount = 0

  const colliderPositions: number[] = []
  const colliderNormals: number[] = []
  const colliderIndices: number[] = []

  if (vertData) {
    for (let i = 0; i < vertData.length; i += 8 * 3) {
      const textureIndex = vertData[i + 7]
      // glass mesh
      if (textureIndex === 2) {
        glassIndexCount += setVoxelData(vertData, i, glassPositions, glassNormals, glassIndices, glassIndexCount)
        continue
      }
      opaqueIndexCount += setVoxelData(vertData, i, opaquePositions, opaqueNormals, opaqueIndices, opaqueIndexCount)
      opaqueTextureIndices.push(textureIndex, textureIndex, textureIndex)
      ambientOcclusion.push(vertData[a + i + 3], vertData[b + i + 3], vertData[c + i + 3])
    }
  } else {
    console.debug('createAOMesh returned null - corrupted or invalid voxel data')
  }

  // Create the collision mesh
  const greedyResult: MesherOutput = []
  greedyMesher(field, greedyResult)
  let i = 0
  greedyResult.forEach(([min, max]): void => {
    let [z1, y1, x1] = min
    let [z2, y2, x2] = max
    x1 *= VoxelSize
    y1 *= VoxelSize
    z1 *= VoxelSize
    x2 *= VoxelSize
    y2 *= VoxelSize
    z2 *= VoxelSize
    // front face (normal: 0, 0, -1)
    colliderPositions.push(x1, y1, z1, x2, y1, z1, x2, y2, z1, x1, y2, z1)
    colliderNormals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1)
    colliderIndices.push(i, i + 1, i + 3, i + 1, i + 2, i + 3)
    i += 4
    // back face (normal: 0, 0, 1)
    colliderPositions.push(x1, y1, z2, x2, y1, z2, x2, y2, z2, x1, y2, z2)
    colliderNormals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1)
    colliderIndices.push(i, i + 3, i + 1, i + 1, i + 3, i + 2)
    i += 4
    // left face (normal: -1, 0, 0)
    colliderPositions.push(x1, y1, z1, x1, y1, z2, x1, y2, z2, x1, y2, z1)
    colliderNormals.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0)
    colliderIndices.push(i, i + 3, i + 1, i + 1, i + 3, i + 2)
    i += 4
    // right face (normal: 1, 0, 0)
    colliderPositions.push(x2, y1, z1, x2, y1, z2, x2, y2, z2, x2, y2, z1)
    colliderNormals.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0)
    colliderIndices.push(i, i + 1, i + 3, i + 1, i + 2, i + 3)
    i += 4
    // bottom face (normal: 0, -1, 0)
    colliderPositions.push(x1, y1, z1, x1, y1, z2, x2, y1, z2, x2, y1, z1)
    colliderNormals.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0)
    colliderIndices.push(i, i + 1, i + 3, i + 1, i + 2, i + 3)
    i += 4
    // top face (normal: 0, 1, 0)
    colliderPositions.push(x1, y2, z1, x1, y2, z2, x2, y2, z2, x2, y2, z1)
    colliderNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0)
    colliderIndices.push(i, i + 3, i + 1, i + 1, i + 3, i + 2)
    i += 4
  })

  return {
    opaquePositions: new Float32Array(opaquePositions),
    opaqueIndices: new Uint32Array(opaqueIndices),
    opaqueNormals: new Float32Array(opaqueNormals),
    ambientOcclusion: new Float32Array(ambientOcclusion),
    opaqueTextureIndices: new Float32Array(opaqueTextureIndices),
    glassPositions: new Float32Array(glassPositions),
    glassIndices: new Uint32Array(glassIndices),
    glassNormals: new Float32Array(glassNormals),
    colliderPositions: new Float32Array(colliderPositions),
    colliderIndices: new Uint32Array(colliderIndices),
    colliderNormals: new Float32Array(colliderNormals),
  }
}

// Can be used for more efficient cross-thread transfer when calling postMessage()
export const transferableItemsForMesh = (md: MeshData) => [
  md.colliderIndices.buffer,
  md.colliderPositions.buffer,
  md.colliderNormals.buffer,
  md.glassIndices.buffer,
  md.glassPositions.buffer,
  md.glassNormals.buffer,
  md.ambientOcclusion.buffer,
  md.opaqueIndices.buffer,
  md.opaquePositions.buffer,
  md.opaqueNormals.buffer,
  md.opaqueTextureIndices.buffer,
]
