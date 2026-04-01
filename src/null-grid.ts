import type { Scene } from './scene'
import Grid from './grid'

export class NullGrid extends Grid {
  constructor(scene: Scene) {
    const parent = new BABYLON.TransformNode('parcel/parent', scene)
    super(scene, parent)
  }

  get seeksConnection() {
    return false
  }

  get hasField() {
    return false
  }
}
