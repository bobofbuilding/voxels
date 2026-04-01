/* global parcel,globalThis */

import { Feature } from './feature'
import { Animation } from './lib/animations'
import { Color3, Matrix, Quaternion, Vector2, Vector3 } from './lib/maths'

import Parcel, { Space } from './parcel'

if (typeof globalThis !== 'undefined') {
  Object.assign(globalThis, {
    Parcel,
    Space,
    Feature,
    Animation,
    Vector3,
    Quaternion,
    Vector2,
    Color3,
    Matrix,
  })
}

// console.log('Scripting Host Started.')
