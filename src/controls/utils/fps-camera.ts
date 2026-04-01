import OurCamera from './our-camera'
import { coords } from '../../../common/helpers/utils'
import { Scene } from '../../scene'

export function createFirstPersonCamera(scene: Scene, coords: coords): OurCamera {
  const camera = new OurCamera('player-camera', coords?.position || BABYLON.Vector3.Zero(), scene)

  camera.minZ = 0.1
  camera.maxZ = scene.draw.distance * 2.0

  scene.draw.addEventListener('distance-changed', (e) => {
    camera.maxZ = e.detail * 2.0
  })

  camera.checkCollisions = true
  camera.ellipsoid = new BABYLON.Vector3(0.25, 0.85, 0.25)

  // we default to no gravity and enable it once world has loaded
  camera.applyGravity = false

  // field of view
  camera.fov = scene.fov.value
  scene.fov.addEventListener(
    'changed',
    (e) => {
      camera.fov = e.detail.value
    },
    { passive: true },
  )

  // Inertia is gross with pointerlock
  camera.inertia = 0

  // sensitivity
  camera.angularSensibility = scene.cameraSettings.angularSensitivity
  scene.cameraSettings.addEventListener(
    'sensitivity-changed',
    (e) => {
      camera.angularSensibility = e.detail.value
    },
    { passive: true },
  )

  return camera
}
