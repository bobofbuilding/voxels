import { unzlibSync, zlibSync } from 'fflate'
import type { NdArray } from 'ndarray'
import * as ndarray from 'ndarray'
import { VoxelSize } from './constants'
import fill from './ndarray-fill'

interface VoxelObject {
  fieldShape: [number, number, number]
  voxels: string | undefined // cache
}

interface VoxelShape {
  x1: number
  y1: number
  z1: number
  x2: number
  y2: number
  z2: number
}

// calculates how many voxels can fit in the parcel per axis
export function getFieldShape(parcel: VoxelShape): [x: number, y: number, z: number] {
  if (!parcel.hasOwnProperty('x1')) {
    console.warn('voxelshape is missing x1 for calculating field shape')
    return [0, 0, 0]
  }
  return [Math.abs(parcel.x2 - parcel.x1) / VoxelSize, Math.abs(parcel.y2 - parcel.y1) / VoxelSize, Math.abs(parcel.z2 - parcel.z1) / VoxelSize]
}

export function getBufferFromVoxels(obj: VoxelObject): NdArray<Uint16Array> | undefined {
  if (!obj.voxels || obj.voxels.trim() === '') {
    return undefined
  }

  const field = ndarray(new Uint16Array(obj.fieldShape[0] * obj.fieldShape[1] * obj.fieldShape[2]), obj.fieldShape)
  let buf = Buffer.from(obj.voxels, 'base64')
  let inflated = Buffer.from(unzlibSync(buf))
  inflated.copy(Buffer.from(field.data.buffer))

  // mark for GC
  inflated = null!
  buf = null!

  return field
}

export const getVoxelsFromBuffer = (buffer: ArrayBufferLike): string => {
  let buf = Buffer.from(buffer)
  let deflated = Buffer.from(zlibSync(buf))
  const voxels = deflated.toString('base64')
  // mark for GC
  deflated = null!
  buf = null!
  return voxels
}

export function oversizedField(field: NdArray<Uint16Array>, solidMaterialId?: number): NdArray<Uint16Array> {
  const oversize = 2

  const width = field.shape[0]
  const height = field.shape[1]
  const depth = field.shape[2]

  const oversizedField = ndarray(new Uint16Array((width + oversize * 2) * (height + oversize * 2) * (depth + oversize * 2)), [width + oversize * 2, height + oversize * 2, depth + oversize * 2])

  const solid = solidMaterialId || (1 << 15) + 10

  fill(oversizedField, (x: any, y: any, z: any) => {
    x -= 2
    y -= 2
    z -= 2

    let f = field.get(x, y, z)
    if (y == 0) {
      if (x < 0 || z < 0 || x >= width || z >= depth) {
        return 0
      }
      return field.get(x, y, z) ?? solid
    } else if (x >= 0 && y >= 0 && z >= 0 && x <= width - 1 && y <= height - 1 && z <= depth - 1) {
      return field.get(x, y, z)
    } else {
      return 0
    }
  })

  return oversizedField
}
