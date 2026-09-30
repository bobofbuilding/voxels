import { VoxelSize } from '../../common/voxels/constants'

/** One grid square per build block, aligned across 48-meter streamed tiles. */
export function createNeonGridMaterial(name: string, scene: BABYLON.Scene): BABYLON.GridMaterial {
  const material = new BABYLON.GridMaterial(name, scene)
  material.mainColor = BABYLON.Color3.FromHexString('#02060d')
  material.lineColor = BABYLON.Color3.FromHexString('#008fff')
  material.gridRatio = VoxelSize
  material.majorUnitFrequency = 1
  material.minorUnitVisibility = 0.65
  material.opacity = 1
  material.backFaceCulling = false
  material.fogEnabled = true
  return material
}
