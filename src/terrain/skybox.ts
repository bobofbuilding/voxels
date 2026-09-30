// Keep Babylon's standard sky rendering (including XR and color processing), but blend the panorama join.
class SeamlessClouds extends BABYLON.MaterialPluginBase {
  constructor(material: BABYLON.StandardMaterial) {
    super(material, 'SeamlessClouds', 200, {}, true, true)
  }

  getCustomCode(shaderType: string): { [point: string]: string } | null {
    if (shaderType !== 'fragment') return null
    return {
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        #ifdef EMISSIVE
          // The first eighth overlaps the end. Both seam vertices sample u=0.875,
          // and smoothstep keeps the color and slope continuous at the blend boundaries.
          const float cloudOverlap = 0.125;
          const float cloudSpan = 1.0 - cloudOverlap;
          float cloudU = vEmissiveUV.x * cloudSpan;
          vec3 cloudColor = texture2D(emissiveSampler, vec2(cloudU, vEmissiveUV.y)).rgb;
          if (cloudU < cloudOverlap) {
            vec3 cloudEnd = texture2D(emissiveSampler, vec2(cloudU + cloudSpan, vEmissiveUV.y)).rgb;
            cloudColor = mix(cloudEnd, cloudColor, smoothstep(0.0, cloudOverlap, cloudU));
          }
          color.rgb = cloudColor * vEmissiveInfos.y;
        #endif
      `,
    }
  }
}

export default class Skybox {
  private readonly _mesh: BABYLON.Mesh

  constructor(scene: BABYLON.Scene) {
    const material = new BABYLON.StandardMaterial('skybox/neon-clouds', scene)
    material.backFaceCulling = false
    material.disableLighting = true
    material.fogEnabled = false
    // StandardMaterial adds this color to the emissive texture; white washes out the clouds.
    material.emissiveColor = BABYLON.Color3.Black()
    const clouds = new BABYLON.Texture(`${process.env.ASSET_PATH || ''}/textures/neon-clouds-v1.png`, scene)
    // The shader handles the horizontal join; the sampler must not wrap unrelated edge pixels.
    clouds.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE
    clouds.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE
    material.emissiveTexture = clouds
    new SeamlessClouds(material)
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
