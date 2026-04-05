import { StateObservable } from '../utils/state-observable'
import { Environment } from './environment'
import type { Scene } from '../scene'
import { createEvent } from '../utils/EventEmitter'

type SpaceScene = Scene

export class SpacesEnvironment extends Environment<SpaceScene> {
  skybox?: BABYLON.Mesh
  skyboxMaterial?: BABYLON.StandardMaterial
  ground?: BABYLON.Mesh
  groundMaterial: BABYLON.StandardMaterial | undefined
  groundTexture: BABYLON.Texture | undefined

  constructor(parent: BABYLON.TransformNode, scene: SpaceScene) {
    console.debug('Creating SpacesEnvironment')
    super(parent, scene)
  }

  private _groundStateObservable = new StateObservable<'loaded' | 'unloaded'>('unloaded')

  public override get groundStateObservable(): StateObservable<'loaded' | 'unloaded'> {
    return this._groundStateObservable
  }

  override get fogColor() {
    return new BABYLON.Color3(0.5, 0.5, 0.5)
  }

  override get fogDensity() {
    return 0.069
  }

  override get ambient() {
    return 0.5
  }

  override async load() {
    await super.load()

    this.skyboxMaterial = new BABYLON.StandardMaterial('skybox', this.scene)
    this.skyboxMaterial.emissiveColor.set(1, 1, 1)

    this.skybox = BABYLON.Mesh.CreateBox('skybox', 1, this.scene)
    const setSkyboxScale = () => {
      this.skybox?.scaling.setAll(this.scene.draw.distance)
    }
    // adjust skybox size to draw distance
    setSkyboxScale()
    this.scene.draw.addEventListener('distance-changed', setSkyboxScale, { passive: true })

    this.skybox.infiniteDistance = true
    this.skybox.material = this.skyboxMaterial

    this.ground = BABYLON.MeshBuilder.CreatePlane('space/ground', { size: 512 }, this.scene)
    this.ground.parent = this.parent
    this.ground.rotate(BABYLON.Axis.X, Math.PI / 2)
    this.ground.position.y = 0.75
    this.ground.checkCollisions = true

    this.groundStateObservable.setState('loaded')

    const t = new BABYLON.Texture('/textures/01-grid.png', this.scene)
    t.uScale = 1024
    t.vScale = 1024
    t.uOffset = 0.5
    t.vOffset = 0.5

    this.groundMaterial = new BABYLON.StandardMaterial('space/ground', this.scene)
    this.groundMaterial.diffuseColor.set(1, 1, 1)
    this.groundMaterial.diffuseTexture = t
    this.groundMaterial.specularColor.set(0, 0, 0)
    this.groundMaterial.zOffset = 1

    if (this.ground) {
      this.ground.material = this.groundMaterial
    }
  }

  override update() {
    /** noop **/
  }

  public override invalidateGroundLoaded() {
    // No-op for Spaces - ground loading is not applicable in space environment
  }

  parcelMeshesAdded(meshes: BABYLON.Mesh[]) {
    meshes.forEach((parcelMesh) => {
      if (!parcelMesh || !parcelMesh.checkCollisions) return
      this.dispatchEvent(createEvent('parcel-collider-added', parcelMesh))
    })
  }

  parcelMeshesRemoved(meshes: BABYLON.Mesh[]) {
    meshes.forEach((parcelMesh) => {
      if (!parcelMesh || !parcelMesh.checkCollisions) return
      this.dispatchEvent(createEvent('parcel-collider-removed', parcelMesh))
    })
  }
}
