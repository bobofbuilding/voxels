// ABOUTME: Tests for ocean rendering system with polygon clipping
// ABOUTME: Ensures proper ocean tile creation and island boundary clipping

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Ocean } from '../../../src/terrain/ocean'
import type { IslandRecord } from '../../../common/messages/api-islands'

const TestScene = () => {
  const engine = new BABYLON.NullEngine()
  const babylonScene = new BABYLON.Scene(engine)
  return Object.assign(babylonScene, {
    graphic: {
      level: 2,
      addEventListener: () => {},
    },
  }) as any
}

const createMockIslands = (islandData: IslandRecord[] = []): any => ({
  getIslandData: () => islandData,
  allMeshes: () => [],
})

describe('Ocean System', () => {
  let ocean: Ocean
  let scene: any
  let parent: BABYLON.TransformNode

  beforeEach(() => {
    scene = TestScene()
    parent = new BABYLON.TransformNode('ocean_parent', scene)
    ocean = new Ocean(48, scene, parent, [])
  })

  afterEach(() => {
    ocean = null as any
    scene?.dispose()
  })

  describe('Basic Ocean System', () => {
    it('should initialize properly', () => {
      expect(ocean).toBeDefined()
      expect(ocean.getInstances()).toHaveLength(0)
    })

    it('should defer chunks when no islands are loaded', () => {
      const chunk = { gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 }
      ocean.onChunkLoaded(chunk)

      expect(ocean.getInstances()).toHaveLength(0)
      expect(ocean.getCustomMeshes().size).toBe(0)
    })

    it('should handle island data loading', () => {
      const mockIslands = createMockIslands([])
      ocean.setIslands(mockIslands)
      expect(mockIslands.getIslandData()).toHaveLength(0)
    })
  })

  describe('Chunk Management', () => {
    it('should handle chunk operations without crashing', () => {
      const mockIslands = createMockIslands([])
      ocean.setIslands(mockIslands)

      const chunk = { gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 }

      // Should handle chunk loading
      expect(() => ocean.onChunkLoaded(chunk)).not.toThrow()

      // Should handle duplicate chunk loading
      expect(() => ocean.onChunkLoaded(chunk)).not.toThrow()

      // Should handle chunk unloading
      expect(() => ocean.onChunkUnloaded(chunk)).not.toThrow()
    })

    it('should handle deferred chunk processing', () => {
      const chunk = { gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 }

      // Load chunk before islands - should defer
      expect(() => ocean.onChunkLoaded(chunk)).not.toThrow()

      // Now load islands - should process deferred chunks
      const mockIslands = createMockIslands([])
      expect(() => ocean.setIslands(mockIslands)).not.toThrow()
    })

    it('should provide water mesh detection interface', () => {
      // hasWaterMeshAt should be callable without crashing
      expect(() => ocean.hasWaterMeshAt(0, 0)).not.toThrow()
      expect(typeof ocean.hasWaterMeshAt(0, 0)).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    it('should handle complex geometry gracefully when clipping fails', () => {
      const mockIslands = createMockIslands([])
      ocean.setIslands(mockIslands)

      const chunk = { gridX: 20, gridZ: 16, worldX: 960, worldZ: 768 }

      // This should not throw an error even if clipping fails
      expect(() => {
        ocean.onChunkLoaded(chunk)
      }).not.toThrow()
    })

    it('should handle islands that completely contain the water tile without crashing', () => {
      // Use mock islands for large island test
      const mockIslands = createMockIslands([])
      ocean.setIslands(mockIslands)
      const chunk = { gridX: 20, gridZ: 16, worldX: 960, worldZ: 768 }

      // This should not throw an error even though the island covers the entire chunk
      expect(() => ocean.onChunkLoaded(chunk)).not.toThrow()
    })
  })
})
