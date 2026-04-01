import { generateCacheKey, getCachedMaterial, cacheMaterial } from '../materials/cache'
import type { Scene } from '../scene'
import VertexShader from './ao-mesh.vsh'
import FragmentShader from './ao-mesh.fsh'
import { defaultColors } from '../../common/content/blocks'

// Frame-tracked onBind: Ensures uniforms are only updated once per frame per material instance
function createFrameTrackedOnBind(material: BABYLON.ShaderMaterial, scene: Scene) {
  let lastUpdateFrame = -1

  return () => {
    const currentFrame = scene.getFrameId()

    // Only update uniforms once per frame for this material instance
    if (currentFrame !== lastUpdateFrame) {
      lastUpdateFrame = currentFrame

      if (scene.environment) {
        material.setVector3('lightDirection', scene.environment.sunPosition)
      }
    }
  }
}

export function createVoxelMaterial(name: string, scene: Scene, texture: BABYLON.Texture, palette?: BABYLON.Color3[], brightness = 1.0, tileSize = 128, tileCount = 4.0): BABYLON.Material {
  const cacheKey = generateCacheKey('voxel', { texture, palette, brightness, tileSize, tileCount })

  const cached = getCachedMaterial(cacheKey)
  if (cached) {
    if (cached instanceof BABYLON.ShaderMaterial) {
      cached.onBind = createFrameTrackedOnBind(cached, scene)
    }
    return cached
  }

  const uniforms = ['worldViewProjection', 'tileSize', 'tileCount', 'brightness', 'ambient', 'lightDirection', 'fogDensity', 'fogColor', 'palette', 'alpha']

  const material = new BABYLON.ShaderMaterial(
    name,
    scene,
    {
      vertexSource: VertexShader,
      fragmentSource: FragmentShader,
    },
    {
      attributes: ['position', 'normal', 'block', 'ambientOcclusion'],
      uniforms: uniforms,
      samplers: ['tileMap'],
      defines: ['#define IMAGEPROCESSINGPOSTPROCESS'],
    },
  )

  // Set texture and voxel parameters
  material.setTexture('tileMap', texture)
  material.setFloat('tileSize', tileSize)
  material.setFloat('tileCount', tileCount)
  material.setFloat('alpha', 1.0)

  // Set palette colors
  const paletteColors = palette || defaultColors.map((c) => BABYLON.Color3.FromHexString(c))
  if (paletteColors && paletteColors[1]) {
    material.setColor3Array('palette', paletteColors)
  }

  // Set environment parameters (lighting, fog, etc)
  scene.environment?.setShaderParameters(material, brightness)

  // Use frame-tracked onBind callback
  material.onBind = createFrameTrackedOnBind(material, scene)

  // Block dirty mechanism to prevent unnecessary recompilation
  material.blockDirtyMechanism = true

  cacheMaterial(cacheKey, material)
  return material
}
