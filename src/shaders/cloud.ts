import VertexShader from './cloud.vsh'
import FrameShader from './cloud.fsh'

const shaderName = 'cloud'

BABYLON.Effect.ShadersStore[`${shaderName}VertexShader`] = VertexShader
BABYLON.Effect.ShadersStore[`${shaderName}PixelShader`] = FrameShader

export class CloudMaterial extends BABYLON.ShaderMaterial {
  private time = 0.0

  constructor(name: string, scene: BABYLON.Scene) {
    super(
      name,
      scene,
      { vertex: shaderName, fragment: shaderName },
      {
        attributes: ['position', 'normal', 'uv'],
        uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection'],
        needAlphaBlending: true,
        needAlphaTesting: true,
        defines: ['#define IMAGEPROCESSINGPOSTPROCESS'],
      },
    )
    this.needDepthPrePass = true
    this.backFaceCulling = false
    this.setFloat('time', this.time)
    this.setFloat('alpha', this.alpha)

    scene.registerBeforeRender(() => {
      this.setFloat('time', this.time)
      this.setFloat('alpha', this.alpha)
      this.time += scene.getEngine().getDeltaTime() / 1000
    })
  }

  private _emissiveColor = new BABYLON.Color4(0.04, 0.0, 0.05, 0.05)

  // for glow effect
  get emissiveColor(): BABYLON.Color4 {
    return this._emissiveColor
  }
}
