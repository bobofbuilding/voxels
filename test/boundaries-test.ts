import * as test from 'tape'
import 'babylonjs-loaders'
import 'babylonjs-materials'

import { distanceToAABB } from '../src/utils/boundaries'

test('distanceToBoundingBox', (t) => {
  // make a 3x3x3 box around the origin
  const min = new BABYLON.Vector3(-1, -1, -1)
  const max = new BABYLON.Vector3(1, 1, 1)
  const boundingBox = new BABYLON.BoundingBox(min, max)

  const tests = [
    { x: 0, y: 0, z: 0, expected: 0 }, // inside, clamped to 0
    { x: 2, y: 0, z: 0, expected: 1 },
    { x: 2, y: 3, z: 0, expected: 2.23606797749979 },
    { x: 2, y: 3, z: 4, expected: 3.7416573867739413 },
    { x: -2, y: 0, z: 0, expected: 1 },
    { x: -2, y: -3, z: 0, expected: 2.23606797749979 },
    { x: -2, y: -3, z: -4, expected: 3.7416573867739413 },
  ]
  t.plan(tests.length)

  tests.forEach((tc) => {
    const point = new BABYLON.Vector3(tc.x, tc.y, tc.z)
    const res = distanceToAABB(point, boundingBox)
    t.equals(res, tc.expected, `point at ${point.toString()}`)
  })
})
