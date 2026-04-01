export function createOrbitCamera(scene: BABYLON.Scene, position: BABYLON.Vector3): BABYLON.ArcRotateCamera {
  // Parameters: alpha, beta, radius, target position, scene
  const camera = new BABYLON.ArcRotateCamera('Camera', -1.57, 1.8, 20, position, scene)

  camera.panningSensibility = 0
  camera.useAutoRotationBehavior = true
  if (camera.autoRotationBehavior) {
    camera.autoRotationBehavior.idleRotationSpeed = Math.PI / 8
    camera.autoRotationBehavior.idleRotationWaitTime = 20000
  }

  camera.lowerRadiusLimit = 10
  camera.upperRadiusLimit = 40
  camera.lowerBetaLimit = 0
  camera.upperBetaLimit = 1.2

  camera.checkCollisions = false
  return camera
}
