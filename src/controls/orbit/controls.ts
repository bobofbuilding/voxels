import Controls from '../controls'
import OurCamera from '../utils/our-camera'
import { createOrbitCamera } from '../utils/orbit-camera'
import { decodeCoordsFromURL } from '../../utils/helpers'

export default class OrbitControls extends Controls {
  createCamera() {
    const coords = decodeCoordsFromURL()
    return createOrbitCamera(this.scene, coords?.position || BABYLON.Vector3.Zero())
  }

  addControls(camera: OurCamera | BABYLON.ArcRotateCamera) {
    camera.attachControl(this.canvas, true)
    this.scene.registerBeforeRender(() => {
      this.reticuleNormal.visibility = 0
      this.reticuleHighlight.visibility = 0
    })
  }
}
