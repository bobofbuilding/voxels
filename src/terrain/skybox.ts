export default class Skybox {
  private readonly _mesh: BABYLON.Mesh

  constructor(scene: BABYLON.Scene) {
    const material = new BABYLON.StandardMaterial('skybox/neon-clouds', scene)
    material.backFaceCulling = false
    material.disableLighting = true
    material.fogEnabled = false
    material.emissiveColor = BABYLON.Color3.White()
    material.emissiveTexture = new BABYLON.Texture(`${process.env.ASSET_PATH || ''}/textures/neon-clouds-v1.png`, scene)
    material.diffuseColor = BABYLON.Color3.Black()
    material.specularColor = BABYLON.Color3.Black()

    const mesh = BABYLON.MeshBuilder.CreateSphere('skybox', { segments: 32, diameter: 1 }, scene)
    const updateScale = (distance: number) => mesh.scaling.setAll(distance * 1.96)
    const onDistance = (event: CustomEvent<number>) => updateScale(event.detail)
    updateScale(window.draw.distance)
    window.draw.addEventListener('distance-changed', onDistance)
    mesh.onDisposeObservable.addOnce(() => {
      window.draw.removeEventListener('distance-changed', onDistance)
      material.dispose(false, true)
    })
    mesh.material = material
    mesh.infiniteDistance = true
    mesh.isPickable = false
    this._mesh = mesh
  }

  get mesh(): BABYLON.Mesh {
    return this._mesh
  }
}
