export type Quaternion = [x: number, y: number, z: number, w: number]

// compress a quaternion from a 4 * number (32b) into a 4 * byte (4b) with some loss in precision and some clever hacking.
// note: that if the data passed in isn't a valid unit (rotation) quaternion the output will be rubbish.
export function compressQuaternion(a: Quaternion) {
  const result = []
  // find the position of the largest absolute value in the array
  const largestIdx = a.reduce((iMax, x, i, arr) => (Math.abs(x) > Math.abs(arr[iMax]) ? i : iMax), 0)
  // put all the other values in smallest
  const smallest = a.filter((c, idx) => idx != largestIdx)
  // contains data about which array value is the largest and what sign (+/-) the other values have
  let metaData = 0
  metaData |= largestIdx
  // find out the signs for the smallest values
  for (let i = 0; i < 3; i++) {
    let isNegative = smallest[i] > 0 ? 0 : 1
    if (a[largestIdx] < 0) {
      // invert sign if the largest value is negative, because the largest value is always positive at decompression
      isNegative = isNegative ? 0 : 1
    }
    // we set the bit to 1 if the value is negative
    metaData |= isNegative << (3 + i)
  }
  result.push(metaData)
  // compress the smallest values to 0 - 256 (which fits in a byte)
  const compressed = smallest.map((v) => Math.round(Math.abs(v) * 256))
  // push the compressed smallest values into the result
  result.push(...compressed)
  // note: we dont need the largest value, since it can recomputed on the other side
  return Uint8Array.from(result)
}

// if the input isn't a valid unit (rotation) quaternion this func will return a non rotational quaternion
export function decompressQuaternion(a: Iterable<number>): Quaternion {
  const data = Uint8Array.from(a)
  // first byte contains the meta data about the quaternion
  const metaData = data[0]
  // find which value in the quaternion is the largest
  const largestIdx = metaData & 3
  // get the signs (+/-) for the smallest three values in the quaternion
  const signs = []
  signs[0] = (metaData >> 3) & 1
  signs[1] = (metaData >> 4) & 1
  signs[2] = (metaData >> 5) & 1

  const result = []
  let sum = 0
  for (let i = 0; i < 3; i++) {
    // convert value back from 0...255 to 0...1 float
    result[i] = data[i + 1] / 255
    // calculate the length of all the smallest values
    sum += result[i] * result[i]
    if (signs[i]) result[i] *= -1
  }
  // we calculate the largest value from the smaller one and inserts it at correct place
  result.splice(largestIdx, 0, Math.sqrt(1 - sum))

  // if this isn't a valid rotation quaternion, we return a valid quat with no rotation
  if (!isValidUnitQuaternion(result[0], result[1], result[2], result[3])) {
    return [1, 0, 0, 0]
  }

  return [result[0], result[1], result[2], result[3]]
}

function isValidUnitQuaternion(x: number, y: number, z: number, w: number) {
  const a = x * x + y * y + z * z + w * w
  return a - 1 < 10e-6
}
