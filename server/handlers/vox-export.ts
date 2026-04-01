import assert from 'assert'
import { Request, Response } from 'express'
import ndarray, { NdArray } from 'ndarray'
import zlib from 'zlib'
import log from '../lib/logger'

class Chunk {
  field: any

  constructor(field: any) {
    this.field = field
  }

  get length() {
    return 12 + this.content.byteLength
  }

  get name() {
    return ''
  }

  get content(): ArrayBuffer {
    return new ArrayBuffer(0)
  }

  get children(): Array<Chunk> {
    return []
  }
}

class Main extends Chunk {
  get name() {
    return 'MAIN'
  }

  get children() {
    return [new Size(this.field), new Voxels(this.field)]
  }
}

class Size extends Chunk {
  get name() {
    return 'SIZE'
  }

  get content(): ArrayBuffer {
    const buffer = new ArrayBuffer(12)
    const d = new DataView(buffer)

    d.setInt32(0, this.field.shape[0], true)
    d.setInt32(4, this.field.shape[1], true)
    d.setInt32(8, this.field.shape[2], true)

    return buffer
  }
}

class Voxels extends Chunk {
  get name() {
    return 'XYZI'
  }

  get content(): ArrayBuffer {
    let count = 0

    for (let x = 0; x < this.field.shape[0]; x++) {
      for (let y = 0; y < this.field.shape[1]; y++) {
        for (let z = 0; z < this.field.shape[2]; z++) {
          if (this.field.get(x, y, z)) {
            count++
          }
        }
      }
    }

    const buffer = new ArrayBuffer(4 + count * 4)
    const d = new DataView(buffer)

    let offset = 0

    d.setInt32(offset, count, true)
    offset += 4

    for (let x = 0; x < this.field.shape[0]; x++) {
      for (let y = 0; y < this.field.shape[1]; y++) {
        for (let z = 0; z < this.field.shape[2]; z++) {
          if (this.field.get(x, y, z)) {
            d.setUint8(offset, x)
            offset++
            d.setUint8(offset, z)
            offset++
            d.setUint8(offset, y)
            offset++

            const c = this.field.get(x, y, z)
            d.setUint8(offset, c % 256)
            offset++
          }
        }
      }
    }

    return buffer
  }
}

const ndarrayToArrayBuffer = (ndarray: NdArray): ArrayBuffer => {
  const buffer = new ArrayBuffer(2000000)
  const d = new DataView(buffer)
  const u = new Uint8Array(buffer)

  d.setUint8(0, 'V'.charCodeAt(0))
  d.setUint8(1, 'O'.charCodeAt(0))
  d.setUint8(2, 'X'.charCodeAt(0))
  d.setUint8(3, ' '.charCodeAt(0))
  d.setInt32(4, 150, true)

  let offset = 8

  const writeChunk = (name: string, content?: ArrayBuffer, children?: Array<Chunk>) => {
    assert(name.length === 4)

    log.info(`Wrote ${name} chunk`)

    name.split('').forEach((c) => {
      d.setUint8(offset, c.charCodeAt(0))
      offset++
    })

    d.setInt32(offset, content ? content.byteLength : 0, true)
    offset += 4

    const sum = (a: any, v: any) => a + v
    d.setInt32(offset, children!.map((c) => c.length).reduce(sum, 0), true)
    offset += 4

    u.set(new Uint8Array(content!), offset)
    // while (i < content.byteLength) {
    //   buffer[offset] = content[i] // d.setUint8(offset, content[i])

    //   offset++
    //   i++
    // }
    // }

    offset += content!.byteLength

    children!.forEach((child) => {
      writeChunk(child.name, child.content, child.children)
    })
  }

  const main = new Main(ndarray)
  writeChunk(main.name, main.content, main.children)

  return buffer
}

export default function (parcel: any, req: Request, res: Response) {
  const voxelSize = 0.5
  const width = (parcel.x2 - parcel.x1) / voxelSize
  const height = (parcel.y2 - parcel.y1) / voxelSize
  const depth = (parcel.z2 - parcel.z1) / voxelSize
  const resolution = [width, height, depth]

  const field = ndarray(new Uint16Array(width * height * depth), resolution)
  const buffer = Buffer.from(parcel.content.voxels, 'base64')
  const inflated = zlib.inflateSync(buffer)
  inflated.copy(Buffer.from(field.data.buffer))

  const b = ndarrayToArrayBuffer(field)

  const fn = 'parcel-' + parcel.address.toLowerCase().replace(/ /g, '-') + '.vox'
  res.set('Content-Disposition', `attachment; filename="${fn}"`)
  res.set('Content-Type', 'application/octet-stream')

  res.end(Buffer.from(b), 'binary')
}
