import { createNeonGridMaterial } from './neon-grid'

export interface IslandMaterialConfig {
  name: string
}

export function createIslandMaterial(scene: BABYLON.Scene, config: IslandMaterialConfig): BABYLON.Material {
  return createNeonGridMaterial(`island/${config.name}`, scene)
}
