import * as ndarray from 'ndarray'

export default function fill(field: ndarray.NdArray<Uint16Array>, func: (x: number, y: number, z: number) => number) {
  let { shape } = field

  for (let x = 0; x < shape[0]; x++) {
    for (let y = 0; y < shape[1]; y++) {
      for (let z = 0; z < shape[2]; z++) {
        field.set(x, y, z, func(x, y, z))
      }
    }
  }
}
