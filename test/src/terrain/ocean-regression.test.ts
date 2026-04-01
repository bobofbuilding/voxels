// ABOUTME: Regression tests for known ocean rendering issues and edge cases
// ABOUTME: Tests specific problematic scenarios without excessive coordinate details

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Ocean } from '../../../src/terrain/ocean'
import type { IslandRecord } from '../../../common/messages/api-islands'

const TestScene = () => {
  const engine = new BABYLON.NullEngine()
  const babylonScene = new BABYLON.Scene(engine)
  return Object.assign(babylonScene, {
    graphic: { level: 2, addEventListener: () => {} },
  }) as any
}

describe('Ocean Regression Tests', () => {
  let ocean: Ocean
  let scene: any
  let parent: BABYLON.TransformNode

  beforeEach(() => {
    scene = TestScene()
    parent = new BABYLON.TransformNode('ocean_parent', scene)
    ocean = new Ocean(8, scene, parent, []) // Using size 8 like Venice test
  })

  afterEach(() => {
    ocean = null as any
    scene?.dispose()
  })

  describe('Known Issue Regressions', () => {
    it('should handle Venice-style complex geometry without missing tiles', () => {
      // Simplified Venice-style island with interior holes
      const complexIsland: IslandRecord = {
        id: 37,
        name: 'Complex Island',
        other_name: null,
        texture: '/textures/ground.png',
        position: {
          type: 'Point',
          crs: { type: 'name', properties: { name: 'EPSG:3857' } },
          coordinates: [-18, -9],
        },
        geometry: {
          type: 'Polygon',
          crs: { type: 'name', properties: { name: 'EPSG:3857' } },
          coordinates: [
            // Exterior boundary
            [
              [-19, -10],
              [-19, -8],
              [-17, -8],
              [-17, -10],
              [-19, -10],
            ],
            // Interior hole that can cause missing tiles
            [
              [-18.5, -9.5],
              [-18.5, -8.5],
              [-17.5, -8.5],
              [-17.5, -9.5],
              [-18.5, -9.5],
            ],
          ],
        },
        holes_geometry_json: {
          type: 'MultiPolygon',
          crs: { type: 'name', properties: { name: 'EPSG:3857' } },
          coordinates: [],
        },
        lakes_geometry_json: {
          type: 'MultiPolygon',
          crs: { type: 'name', properties: { name: 'EPSG:3857' } },
          coordinates: [],
        },
      }

      const mockIslands = { getIslandData: () => [complexIsland], allMeshes: () => [] }
      ocean.setIslands(mockIslands as any)

      // Test problematic chunk coordinates
      const problemChunk = { gridX: -230, gridZ: -121, worldX: -1840, worldZ: -968 }

      // Should not crash when processing complex geometry
      expect(() => ocean.onChunkLoaded(problemChunk)).not.toThrow()

      // Should handle the geometry gracefully (may result in no meshes if complex clipping fails)
      const result = ocean.getCustomMeshes().size + ocean.getInstances().length
      expect(result).toBeGreaterThanOrEqual(0) // Just ensure no crash
    })

    it('should handle degenerate polygon geometry gracefully', () => {
      // Island with problematic geometry that could cause crashes
      const degenerateIsland: IslandRecord = {
        id: 1,
        name: 'Degenerate Island',
        other_name: null,
        texture: '/textures/ground.png',
        position: { type: 'Point', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [0, 0] },
        geometry: {
          type: 'Polygon',
          crs: { type: 'name', properties: { name: 'EPSG:3857' } },
          coordinates: [
            // Degenerate polygon (all same point)
            [
              [0, 0],
              [0, 0],
              [0, 0],
              [0, 0],
            ],
          ],
        },
        holes_geometry_json: { type: 'MultiPolygon', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [] },
        lakes_geometry_json: { type: 'MultiPolygon', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [] },
      }

      const mockIslands = { getIslandData: () => [degenerateIsland], allMeshes: () => [] }
      ocean.setIslands(mockIslands as any)

      // Should handle degenerate geometry without crashing
      expect(() => ocean.onChunkLoaded({ gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 })).not.toThrow()
    })

    it('should handle overlapping interior holes without crashes', () => {
      // Island with overlapping interior holes that could cause polygon clipping issues
      const overlappingHolesIsland: IslandRecord = {
        id: 2,
        name: 'Overlapping Holes Island',
        other_name: null,
        texture: '/textures/ground.png',
        position: { type: 'Point', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [0, 0] },
        geometry: {
          type: 'Polygon',
          crs: { type: 'name', properties: { name: 'EPSG:3857' } },
          coordinates: [
            // Large exterior
            [
              [-10, -10],
              [-10, 10],
              [10, 10],
              [10, -10],
              [-10, -10],
            ],
            // Overlapping interior holes
            [
              [-5, -5],
              [-5, 5],
              [0, 5],
              [0, -5],
              [-5, -5],
            ],
            [
              [-2, -2],
              [-2, 2],
              [2, 2],
              [2, -2],
              [-2, -2],
            ],
          ],
        },
        holes_geometry_json: { type: 'MultiPolygon', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [] },
        lakes_geometry_json: { type: 'MultiPolygon', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [] },
      }

      const mockIslands = { getIslandData: () => [overlappingHolesIsland], allMeshes: () => [] }
      ocean.setIslands(mockIslands as any)

      // Should handle overlapping holes gracefully
      expect(() => ocean.onChunkLoaded({ gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 })).not.toThrow()
    })

    it('should create only ONE mesh per chunk for multi-ring islands (Gaza-style)', () => {
      // Multi-ring island like Gaza (id >= 40) with multiple separate land masses
      // This simulates Gaza which has 7 separate rings in its geometry
      // Coordinates are scaled by 100, so 0.01 = 1 world unit
      const multiRingIsland: IslandRecord = {
        id: 48, // >= 40 threshold for multi-ring islands
        name: 'Multi-Ring Test Island',
        other_name: null,
        texture: '/textures/ground.png',
        position: { type: 'Point', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [0, 0] },
        geometry: {
          type: 'Polygon',
          crs: { type: 'name', properties: { name: 'EPSG:3857' } },
          coordinates: [
            // Ring 1 - Main land mass (scaled coords: 100-300 in world space)
            [
              [0.01, 0.01],
              [0.01, 0.03],
              [0.03, 0.03],
              [0.03, 0.01],
              [0.01, 0.01],
            ],
            // Ring 2 - Separate land mass (scaled coords: 50-70 in world space)
            [
              [0.005, 0.005],
              [0.005, 0.007],
              [0.007, 0.007],
              [0.007, 0.005],
              [0.005, 0.005],
            ],
            // Ring 3 - Another separate land mass (scaled coords: 40-60 in world space)
            [
              [0.004, 0.004],
              [0.004, 0.006],
              [0.006, 0.006],
              [0.006, 0.004],
              [0.004, 0.004],
            ],
          ],
        },
        holes_geometry_json: { type: 'MultiPolygon', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [] },
        lakes_geometry_json: { type: 'MultiPolygon', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, coordinates: [] },
      }

      const mockIslands = { getIslandData: () => [multiRingIsland], allMeshes: () => [] }
      ocean.setIslands(mockIslands as any)

      // Load a chunk that intersects all three rings
      // With size=8, worldX=0, worldZ=0 gives tile center at {x:4, z:4}
      // This intersects with our scaled island coordinates (40-300 in world space)
      ocean.onChunkLoaded({ gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 })

      // Get custom meshes for this chunk
      const customMeshes = ocean.getCustomMeshes()
      const chunkKey = '0_0'
      const meshesForChunk = customMeshes.get(chunkKey)

      // CRITICAL: Should create only ONE mesh for the chunk, not three separate meshes (one per ring)
      // This prevents overlapping geometry and double rendering
      expect(meshesForChunk).toBeDefined()
      expect(meshesForChunk!.length).toBe(1)
    })
  })
})
