import { GraphicLevels } from '../graphic/graphic-engine'
import type { Scene } from '../scene'

export default class CustomSkybox {
  currentSkybox: string | null = null
  private readonly _mesh: BABYLON.Mesh
  private _material: BABYLON.StandardMaterial | null = null

  constructor(private scene: Scene) {
    const mesh = BABYLON.MeshBuilder.CreateSphere('skybox/local', { segments: 16, diameter: 1 }, scene)
    mesh.isVisible = false
    mesh.infiniteDistance = true
    mesh.isPickable = false
    this._mesh = mesh
    mesh.alphaIndex = 1 // render behind all other alpha blended meshes except the global skybox

    const setSkyboxScale = (drawDistance: number) => {
      mesh.scaling.setAll(drawDistance * 1.955) // just a little smaller than the main skybox to prevent z-fighting
    }
    setSkyboxScale(scene.draw.distance)
    scene.draw.addEventListener('distance-changed', (e) => setSkyboxScale(e.detail))

    this.scene.onBeforeRenderObservable.add(() => {
      if (this._material && this._material.alpha !== this._opacity) {
        this._material.alpha = this._opacity
        this._mesh.isVisible = this._opacity > 0
      }
    })
  }

  private _opacity = 0

  get opacity(): number {
    return this._opacity
  }

  set opacity(opacity: number) {
    this._opacity = opacity
  }

  get mesh(): BABYLON.Mesh {
    return this._mesh
  }

  loadSkybox(skyboxName: string) {
    const material = new BABYLON.StandardMaterial('skybox/local/' + skyboxName, this.scene)
    material.backFaceCulling = false
    material.reflectionTexture = new BABYLON.CubeTexture(`./skybox/${skyboxName}${this.scene.graphic.getSettings().level < GraphicLevels.Medium ? '_min' : ''}`, this.scene)
    material.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE
    material.diffuseColor = new BABYLON.Color3(0, 0, 0)
    material.specularColor = new BABYLON.Color3(0, 0, 0)
    material.disableLighting = true
    material.fogEnabled = false
    material.blockDirtyMechanism = true

    if (this._material) {
      this._material.dispose()
      this._material = null
    }
    this._mesh.material = material
    this._material = material
    this.currentSkybox = skyboxName
  }

  setSkybox(skyboxName: string, opacity: number) {
    if (this.currentSkybox !== skyboxName) {
      this.loadSkybox(skyboxName)
    }

    if (this.opacity !== opacity) {
      this.opacity = opacity
    }
  }

  clearSkybox() {
    this._mesh.material = null
    this._material?.dispose()
    this._material = null
    this.currentSkybox = null
  }

  dispose() {
    this._mesh.dispose()
    this._material?.dispose()
  }
}
