// ABOUTME: Tests for the chunk loading system that manages tile lifecycle
// ABOUTME: Covers chunk creation, camera-based loading, observer events, and garbage collection

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChunkSystem, type ChunkObserver, type ChunkPosition } from '../../../src/terrain/chunk-system'

describe('ChunkSystem', () => {
  let chunkSystem: ChunkSystem
  const CHUNK_SIZE = 48

  beforeEach(() => {
    chunkSystem = new ChunkSystem(CHUNK_SIZE)
  })

  describe('Basic chunk operations', () => {
    it('should create chunks with correct grid positions', () => {
      const cameraPos = { x: 0, z: 0 }
      const loadRange = 1 // 3x3 grid around camera

      chunkSystem.updateChunksAroundPosition(cameraPos, loadRange)

      const loadedChunks = chunkSystem.getLoadedChunks()

      // Should load 3x3 = 9 chunks around camera
      expect(loadedChunks.length).toBe(9)

      // Check that center chunk exists at (0,0)
      const centerChunk = loadedChunks.find((chunk) => chunk.gridX === 0 && chunk.gridZ === 0)
      expect(centerChunk).toBeDefined()
      expect(centerChunk!.worldX).toBe(0) // Corner-based coordinates
      expect(centerChunk!.worldZ).toBe(0) // Corner-based coordinates
    })

    it('should convert world positions to grid coordinates correctly', () => {
      expect(chunkSystem.worldToGrid({ x: 0, z: 0 })).toEqual({ gridX: 0, gridZ: 0 })
      expect(chunkSystem.worldToGrid({ x: 48, z: 48 })).toEqual({ gridX: 1, gridZ: 1 })
      expect(chunkSystem.worldToGrid({ x: -24, z: -24 })).toEqual({ gridX: -1, gridZ: -1 })
    })

    it('should convert grid coordinates to world positions correctly', () => {
      expect(chunkSystem.gridToWorld({ gridX: 0, gridZ: 0 })).toEqual({ x: 24, z: 24 })
      expect(chunkSystem.gridToWorld({ gridX: 1, gridZ: 1 })).toEqual({ x: 72, z: 72 })
      expect(chunkSystem.gridToWorld({ gridX: -1, gridZ: -1 })).toEqual({ x: -24, z: -24 })
    })
  })

  describe('Camera-based loading', () => {
    it('should load chunks in correct range around camera', () => {
      const cameraPos = { x: 100, z: 200 }
      const loadRange = 2 // 5x5 grid

      chunkSystem.updateChunksAroundPosition(cameraPos, loadRange)

      const loadedChunks = chunkSystem.getLoadedChunks()
      expect(loadedChunks.length).toBe(25) // 5x5 = 25 chunks

      // Camera is at world (100, 200), which is grid (2, 4)
      const cameraTile = chunkSystem.worldToGrid(cameraPos)
      expect(cameraTile).toEqual({ gridX: 2, gridZ: 4 })

      // Should have chunks from (0,2) to (4,6)
      const minChunk = loadedChunks.reduce(
        (min, chunk) => ({
          gridX: Math.min(min.gridX, chunk.gridX),
          gridZ: Math.min(min.gridZ, chunk.gridZ),
        }),
        { gridX: Infinity, gridZ: Infinity },
      )

      const maxChunk = loadedChunks.reduce(
        (max, chunk) => ({
          gridX: Math.max(max.gridX, chunk.gridX),
          gridZ: Math.max(max.gridZ, chunk.gridZ),
        }),
        { gridX: -Infinity, gridZ: -Infinity },
      )

      expect(minChunk).toEqual({ gridX: 0, gridZ: 2 })
      expect(maxChunk).toEqual({ gridX: 4, gridZ: 6 })
    })

    it('should not reload already loaded chunks', () => {
      const cameraPos = { x: 0, z: 0 }
      const loadRange = 1

      chunkSystem.updateChunksAroundPosition(cameraPos, loadRange)
      const initialCount = chunkSystem.getLoadedChunks().length

      // Update again with same position
      chunkSystem.updateChunksAroundPosition(cameraPos, loadRange)
      const secondCount = chunkSystem.getLoadedChunks().length

      expect(initialCount).toBe(secondCount)
      expect(initialCount).toBe(9)
    })
  })

  describe('Observer pattern', () => {
    it('should notify observers when chunks are loaded', () => {
      const observer: ChunkObserver = {
        onChunkLoaded: vi.fn(),
        onChunkUnloaded: vi.fn(),
      }

      chunkSystem.addObserver(observer)

      const cameraPos = { x: 0, z: 0 }
      chunkSystem.updateChunksAroundPosition(cameraPos, 1)

      // Should have called onChunkLoaded 9 times (3x3 grid)
      expect(observer.onChunkLoaded).toHaveBeenCalledTimes(9)
      expect(observer.onChunkUnloaded).not.toHaveBeenCalled()

      // Check that observer was called with correct chunk data
      expect(observer.onChunkLoaded).toHaveBeenCalledWith(
        expect.objectContaining({
          gridX: 0,
          gridZ: 0,
          worldX: 0,
          worldZ: 0,
        }),
      )
    })

    it('should notify observers when chunks are unloaded', () => {
      const observer: ChunkObserver = {
        onChunkLoaded: vi.fn(),
        onChunkUnloaded: vi.fn(),
      }

      chunkSystem.addObserver(observer)

      // Load initial chunks
      chunkSystem.updateChunksAroundPosition({ x: 0, z: 0 }, 1)

      // Clear mock to focus on unload events
      vi.clearAllMocks()

      // Move camera far away to trigger unloading
      chunkSystem.updateChunksAroundPosition({ x: 1000, z: 1000 }, 1)

      // Should have unloaded the original 9 chunks
      expect(observer.onChunkUnloaded).toHaveBeenCalledTimes(9)
      // And loaded 9 new chunks at the new position
      expect(observer.onChunkLoaded).toHaveBeenCalledTimes(9)
    })

    it('should support multiple observers', () => {
      const observer1: ChunkObserver = {
        onChunkLoaded: vi.fn(),
        onChunkUnloaded: vi.fn(),
      }

      const observer2: ChunkObserver = {
        onChunkLoaded: vi.fn(),
        onChunkUnloaded: vi.fn(),
      }

      chunkSystem.addObserver(observer1)
      chunkSystem.addObserver(observer2)

      chunkSystem.updateChunksAroundPosition({ x: 0, z: 0 }, 1)

      expect(observer1.onChunkLoaded).toHaveBeenCalledTimes(9)
      expect(observer2.onChunkLoaded).toHaveBeenCalledTimes(9)
    })

    it('should allow removing observers', () => {
      const observer: ChunkObserver = {
        onChunkLoaded: vi.fn(),
        onChunkUnloaded: vi.fn(),
      }

      chunkSystem.addObserver(observer)
      chunkSystem.removeObserver(observer)

      chunkSystem.updateChunksAroundPosition({ x: 0, z: 0 }, 1)

      expect(observer.onChunkLoaded).not.toHaveBeenCalled()
    })
  })

  describe('Garbage collection', () => {
    it('should unload chunks that are too far from camera', () => {
      // Load chunks at origin
      chunkSystem.updateChunksAroundPosition({ x: 0, z: 0 }, 2)
      expect(chunkSystem.getLoadedChunks().length).toBe(25) // 5x5

      // Move camera to only overlap partially
      chunkSystem.updateChunksAroundPosition({ x: 96, z: 0 }, 2) // 2 chunks right

      const loadedChunks = chunkSystem.getLoadedChunks()
      expect(loadedChunks.length).toBe(25) // Still 5x5, but different chunks

      // None of the original far-left chunks should remain
      const farLeftChunks = loadedChunks.filter((chunk) => chunk.gridX <= -2)
      expect(farLeftChunks.length).toBe(0)

      // Should have new chunks on the right side
      const farRightChunks = loadedChunks.filter((chunk) => chunk.gridX >= 2)
      expect(farRightChunks.length).toBeGreaterThan(0)
    })
  })

  describe('Dynamic configuration updates', () => {
    it('should update chunk size and reload chunks at runtime', () => {
      const observer: ChunkObserver = {
        onChunkLoaded: vi.fn(),
        onChunkUnloaded: vi.fn(),
      }
      chunkSystem.addObserver(observer)

      // Load chunks with original chunk size
      const cameraPos = { x: 0, z: 0 }
      chunkSystem.updateChunksAroundPosition(cameraPos, 1)
      expect(chunkSystem.getLoadedChunks().length).toBe(9)

      // Verify original chunk size (48) creates center chunk at (0, 0)
      const originalCenterChunk = chunkSystem.getLoadedChunks().find((chunk) => chunk.gridX === 0 && chunk.gridZ === 0)
      expect(originalCenterChunk?.worldX).toBe(0)
      expect(originalCenterChunk?.worldZ).toBe(0)

      vi.clearAllMocks()

      // Update chunk size to 96 (double size)
      chunkSystem.updateChunkSize(96)

      // Should trigger complete reload - unload all old chunks and load new ones
      expect(observer.onChunkUnloaded).toHaveBeenCalledTimes(9)
      expect(observer.onChunkLoaded).toHaveBeenCalledTimes(9)

      // Verify new chunk size creates center chunk at (0, 0)
      const newCenterChunk = chunkSystem.getLoadedChunks().find((chunk) => chunk.gridX === 0 && chunk.gridZ === 0)
      expect(newCenterChunk?.worldX).toBe(0) // Corner-based coordinates
      expect(newCenterChunk?.worldZ).toBe(0)
    })

    it('should handle view distance changes by loading/unloading appropriate chunks', () => {
      const observer: ChunkObserver = {
        onChunkLoaded: vi.fn(),
        onChunkUnloaded: vi.fn(),
      }
      chunkSystem.addObserver(observer)

      // Load chunks with range 1 (3x3 = 9 chunks)
      const cameraPos = { x: 0, z: 0 }
      chunkSystem.updateChunksAroundPosition(cameraPos, 1)
      expect(chunkSystem.getLoadedChunks().length).toBe(9)

      vi.clearAllMocks()

      // Increase view distance by updating the same position with larger range
      chunkSystem.updateChunksAroundPosition(cameraPos, 2)

      // Should have loaded additional chunks (5x5 = 25 total, so 16 new ones)
      expect(observer.onChunkLoaded).toHaveBeenCalledTimes(16)
      expect(observer.onChunkUnloaded).not.toHaveBeenCalled()
      expect(chunkSystem.getLoadedChunks().length).toBe(25)

      vi.clearAllMocks()

      // Decrease view distance back to 1
      chunkSystem.updateChunksAroundPosition(cameraPos, 1)

      // Should unload outer chunks (keeping inner 3x3, unloading outer 16)
      expect(observer.onChunkUnloaded).toHaveBeenCalledTimes(16)
      expect(observer.onChunkLoaded).not.toHaveBeenCalled()
      expect(chunkSystem.getLoadedChunks().length).toBe(9)
    })

    it('should preserve camera position when updating chunk size', () => {
      // Position camera at a specific world position
      const cameraPos = { x: 100, z: 200 }
      chunkSystem.updateChunksAroundPosition(cameraPos, 1)

      // Get the grid coordinates for this camera position
      const originalGrid = chunkSystem.worldToGrid(cameraPos)
      expect(originalGrid).toEqual({ gridX: 2, gridZ: 4 }) // 100/48, 200/48

      // Update chunk size to 24 (half size)
      chunkSystem.updateChunkSize(24)

      // Same world position should now map to different grid coordinates
      const newGrid = chunkSystem.worldToGrid(cameraPos)
      expect(newGrid).toEqual({ gridX: 4, gridZ: 8 }) // 100/24, 200/24

      // But the loaded chunks should still be around the camera
      const loadedChunks = chunkSystem.getLoadedChunks()
      const cameraGridChunk = loadedChunks.find((chunk) => chunk.gridX === newGrid.gridX && chunk.gridZ === newGrid.gridZ)
      expect(cameraGridChunk).toBeDefined()
    })
  })
})
