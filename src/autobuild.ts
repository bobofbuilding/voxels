import ndarray, { NdArray } from 'ndarray'
import Parcel from './parcel'
import { getVoxelsFromBuffer } from '../common/voxels/helpers'

const Blocks = {
  Empty: 0,
  Grid: (1 << 15) + 1,
  Glass: 2,
  White: (1 << 15) + 3,
}

type FillCallback = (x: number, y: number, z: number) => number

export default class Autobuilder {
  parcel: Parcel
  field: NdArray<Uint16Array>
  features: Array<any>

  constructor(parcel: any) {
    this.parcel = parcel
    this.field = ndarray(new Uint16Array(this.width * this.height * this.depth), this.shape)
    this.features = []
  }

  get kind() {
    return this.parcel.kind ?? 'plot'
  }

  private get plot() {
    return this.kind === 'plot'
  }

  private get asset() {
    return this.kind === 'asset'
  }

  get shape() {
    return [this.width, this.height, this.depth]
  }

  get width() {
    return (this.parcel.x2 - this.parcel.x1) / this.voxelSize
  }

  get height() {
    return this.parcel.height
  }

  get depth() {
    return (this.parcel.z2 - this.parcel.z1) / this.voxelSize
  }

  get voxelSize() {
    return 0.5
  }

  fill(cb: FillCallback) {
    const width = this.width
    const height = this.height
    const depth = this.depth

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          const value = cb(x, y, z)
          this.field.set(x, y, z, value)
        }
      }
    }
  }

  build() {
    if (this.asset) {
      this.blankSpace()
    } else {
      this.outline()
    }
  }

  // TAYTAY
  private blankSpace() {
    this.fill((x, y, z) => {
      if (y < 2) {
        return Blocks.Grid
      }

      return Blocks.Empty
    })
  }

  // Rectangular outline
  private outline() {
    const w = this.width
    const h = this.height
    const d = this.depth

    this.fill((x, y, z) => {
      if ((x === 0 && z === 0) || (x === w - 1 && z == 0) || (x === 0 && z == d - 1) || (x === w - 1 && z === d - 1)) {
        // Uprights
        return Blocks.Grid
      } else if (y === h - 1 && (x === 0 || z === 0 || x === w - 1 || z === d - 1)) {
        // Roof
        return Blocks.Grid
      } else if (y === 2 && (x === 0 || z === 0 || x === w - 1 || z === d - 1)) {
        // Lintel
        return Blocks.Grid
      } else if (y < 2) {
        // Floor
        return Blocks.White
      } else {
        return Blocks.Empty
      }
    })
  }

  getVoxels() {
    return getVoxelsFromBuffer(this.field.data.buffer)
  }

  getFeatures() {
    return this.features
  }
}
