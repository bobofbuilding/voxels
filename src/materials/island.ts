import type { Scene } from '../scene'
import { cacheMaterial, generateCacheKey, getCachedMaterial } from './cache'

export interface IslandMaterialConfig {
  name: string
  texture: BABYLON.Texture
}

export function createIslandMaterial(scene: Scene, config: IslandMaterialConfig): BABYLON.Material {
  const cacheKey = generateCacheKey('island', { name: config.name })

  const cached = getCachedMaterial(cacheKey)
  if (cached) return cached

  const material = new BABYLON.StandardMaterial(`island/${config.name}`, scene)

  // Standard material colors
  material.emissiveColor.set(0.7, 0.7, 0.7)
  material.diffuseColor.set(1, 1, 1)
  material.specularColor.set(0, 0, 0)

  // Set diffuse texture
  material.diffuseTexture = config.texture

  // Rendering settings
  material.backFaceCulling = false // Helps with reflections in the water

  material.freeze()
  material.blockDirtyMechanism = true

  cacheMaterial(cacheKey, material)
  return material
}
