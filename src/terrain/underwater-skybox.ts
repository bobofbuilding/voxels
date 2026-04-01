// ABOUTME: Solid-color skybox that renders in front of other skyboxes when underwater
// ABOUTME: Clipped at water surface using scene clip plane

import type { Scene } from '../scene'
import { OCEAN_HEIGHT_OFFSET } from '../constants'

export default class UnderwaterSkybox {
  private mesh: BABYLON.Mesh
  private material: BABYLON.StandardMaterial
  private scene: Scene

  constructor(scene: Scene, color: BABYLON.Color3) {
    this.scene = scene

    const material = new BABYLON.StandardMaterial('skybox/underwater', scene)
    material.backFaceCulling = false
    material.diffuseColor = color
    material.emissiveColor = color
    material.disableLighting = true
    material.fogEnabled = false
    material.freeze()
    this.material = material

    const mesh = BABYLON.MeshBuilder.CreateSphere('skybox/underwater', { segments: 16, diameter: 1 }, scene)

    const updateScale = (drawDistance: number) => {
      mesh.scaling.setAll(drawDistance * 1.75)
    }
    updateScale(scene.draw.distance)
    scene.draw.addEventListener('distance-changed', (e) => updateScale(e.detail))

    mesh.material = material
    mesh.infiniteDistance = true
    mesh.isPickable = false
    mesh.alphaIndex = 10
    mesh.isVisible = false

    this.mesh = mesh
  }

  private updateClipPlane() {
    const normal = new BABYLON.Vector3(0, 1, 0)
    const d = OCEAN_HEIGHT_OFFSET
    this.scene.clipPlane = new BABYLON.Plane(normal.x, normal.y, normal.z, -d)
  }

  setVisible(visible: boolean) {
    this.mesh.isVisible = visible
    if (visible) {
      this.updateClipPlane()
    } else {
      this.scene.clipPlane = null
    }
  }

  dispose() {
    if (this.scene.clipPlane) {
      this.scene.clipPlane = null
    }
    this.mesh.dispose()
    this.material.dispose()
  }
}
