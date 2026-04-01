import { v7 as uuid } from 'uuid'

type nftFragmentStyle = 'nftFrame' | 'nftFrameColors' | 'nftFrameBlue'

export default class NFTFrame {
  frameMaterial: BABYLON.ShaderMaterial
  time = 0

  constructor(scene: BABYLON.Scene, nftFragmentStyle: nftFragmentStyle = 'nftFrame', name: string = uuid()) {
    this.frameMaterial = new BABYLON.ShaderMaterial(
      `feature/nft-image/${name}`,
      scene,
      {
        vertex: 'nft',
        fragment: nftFragmentStyle,
      },
      {
        attributes: ['position', 'uv', 'normal'],
        uniforms: ['worldViewProjection'],
        defines: ['#define IMAGEPROCESSINGPOSTPROCESS'],
      },
    )

    this.frameMaterial.setFloat('time', 0)

    scene.registerBeforeRender(() => {
      this.frameMaterial.setFloat('time', this.time)
      this.time += 0.005
    })
  }

  get material() {
    return this.frameMaterial
  }
}
