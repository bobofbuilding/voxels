import OrbitControls from './controls'
import { createOrbitCamera } from '../utils/orbit-camera'
import { isAsset } from '../../../common/helpers/detector'

export default class OrbitSpaceControls extends OrbitControls {
  createCamera() {
    const position = new BABYLON.Vector3(0, 6, 0)

    const camera = createOrbitCamera(this.scene, position)
    camera.alpha = 0 // -1.58
    camera.beta = 1.8
    camera.radius = 20
    camera.lowerRadiusLimit = 2
    // camera.upperBetaLimit = 2
    // camera.lowerBetaLimit = 1

    if (camera.autoRotationBehavior) {
      camera.autoRotationBehavior.idleRotationSpeed = -Math.PI / 32.0
    }

    if (isAsset()) {
      camera.target.y = 2
      camera.radius = 6
      camera.beta = 1.2

      camera.useAutoRotationBehavior = true
      camera.autoRotationBehavior!.idleRotationSpeed = Math.PI / 16.0
    }

    return camera
  }
}
