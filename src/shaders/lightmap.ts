// ABOUTME: Lightmap shader material for baked voxel rendering with ambient occlusion.
// ABOUTME: Creates shader material that samples tilemap and lightmap textures for pre-baked lighting.

import type { Scene } from '../scene'
import lightmapMeshVertexShader from './lightmap-mesh.vsh'
import lightmapMeshPixelShader from './lightmap-mesh.fsh'

// Register shaders with Babylon's effect store
BABYLON.Effect.ShadersStore['lightmapMeshVertexShader'] = lightmapMeshVertexShader
BABYLON.Effect.ShadersStore['lightmapMeshPixelShader'] = lightmapMeshPixelShader

export function createLightmapMaterial(scene: Scene, name: string): BABYLON.ShaderMaterial {
  const material = new BABYLON.ShaderMaterial(
    `voxelizer/${name}`,
    scene,
    { vertex: 'lightmapMesh', fragment: 'lightmapMesh' },
    {
      attributes: ['position', 'uv', 'uv2', 'normal', 'block'],
      uniforms: ['worldViewProjection', 'tileSize', 'tileCount', 'brightness', 'ambient', 'lightDirection', 'fogDensity', 'fogColor', 'palette'],
      samplers: ['tileMap', 'lightMap'],
      defines: ['#define IMAGEPROCESSINGPOSTPROCESS'],
    },
  )
  material.setFloat('tileSize', 128)
  material.setFloat('tileCount', 4.0)
  material.blockDirtyMechanism = true
  return material
}
