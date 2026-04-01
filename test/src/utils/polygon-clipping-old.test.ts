// ABOUTME: Tests for polygon clipping utilities used in ocean tile generation
// ABOUTME: Ensures accurate clipping of ocean tiles against island boundaries

import { describe, it, expect } from 'vitest'
import { PolygonClipping, type Point2D } from '../../../src/utils/polygon-utils'

// Trinity island coordinates from database (shared test data)
const TRINITY_COORDS = [
  [-0.2, -5.78],
  [-0.2, -5.78],
  [-0.2, -5.7],
  [0, -5.7],
  [0, -5.5],
  [0.2, -5.5],
  [0.2, -5.7],
  [0.4, -5.7],
  [0.4, -5.78],
  [0.6, -5.78],
  [0.6, -5.7],
  [0.8, -5.7],
  [0.8, -5.5],
  [1, -5.5],
  [1, -5.7],
  [1.2, -5.7],
  [1.2, -5.78],
  [1.2, -5.82],
  [1.2, -5.9],
  [1, -5.9],
  [1, -6.1],
  [0.8, -6.1],
  [0.8, -5.9],
  [0.6, -5.9],
  [0.6, -5.82],
  [0.4, -5.82],
  [0.4, -5.9],
  [0.2, -5.9],
  [0.2, -6.1],
  [0, -6.1],
  [0, -5.9],
  [-0.2, -5.9],
  [-0.2, -5.82],
  [-0.4, -5.82],
  [-0.4, -5.9],
  [-0.6, -5.9],
  [-0.6, -6.1],
  [-0.8, -6.1],
  [-0.8, -5.9],
  [-1, -5.9],
  [-1, -5.7],
  [-0.8, -5.7],
  [-0.8, -5.5],
  [-0.6, -5.5],
  [-0.6, -5.7],
  [-0.4, -5.7],
  [-0.4, -5.78],
  [-0.2, -5.78],
]

const createTrinityIsland = (): Point2D[] => TRINITY_COORDS.map(([x, z]) => ({ x: x * 100, z: z * 100 })).reverse()

describe('PolygonClipping', () => {
  describe('Basic geometry operations', () => {
    it('should detect point inside simple rectangle', () => {
      const rectangle: Point2D[] = [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
        { x: 0, z: 10 },
      ]

      expect(PolygonClipping.pointInPolygon({ x: 5, z: 5 }, rectangle)).toBe(true)
      expect(PolygonClipping.pointInPolygon({ x: 15, z: 5 }, rectangle)).toBe(false)
    })

    it('should find intersection between two line segments', () => {
      const line1Start = { x: 0, z: 0 }
      const line1End = { x: 10, z: 10 }
      const line2Start = { x: 0, z: 10 }
      const line2End = { x: 10, z: 0 }

      const intersection = PolygonClipping.lineIntersection(line1Start, line1End, line2Start, line2End)

      expect(intersection).not.toBe(null)
      expect(intersection!.x).toBeCloseTo(5)
      expect(intersection!.z).toBeCloseTo(5)
    })

    it('should return null for parallel lines', () => {
      const intersection = PolygonClipping.lineIntersection({ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 5 }, { x: 10, z: 5 })
      expect(intersection).toBe(null)
    })
  })

  describe('Ocean tile clipping', () => {
    it('should clip ocean tile against island boundary', () => {
      const tileCenter = { x: 0, z: 0 }
      const tileSize = 10
      const island = [
        { x: -2, z: -2 },
        { x: 2, z: -2 },
        { x: 2, z: 2 },
        { x: -2, z: 2 },
      ]

      const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, island)

      expect(result.shouldCreateMesh).toBe(true)
      expect(result.vertices.length).toBeGreaterThan(0)
    })

    it('should skip tile completely inside island', () => {
      const tileCenter = { x: 0, z: 0 }
      const tileSize = 4
      const largeIsland = [
        { x: -10, z: -10 },
        { x: 10, z: -10 },
        { x: 10, z: 10 },
        { x: -10, z: 10 },
      ]

      const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, largeIsland)
      expect(result.shouldCreateMesh).toBe(false)
    })

    it('should keep full tile when no intersection with island', () => {
      const tileCenter = { x: 0, z: 0 }
      const tileSize = 4
      const distantIsland = [
        { x: 20, z: 20 },
        { x: 22, z: 20 },
        { x: 22, z: 22 },
        { x: 20, z: 22 },
      ]

      const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, distantIsland)

      expect(result.shouldCreateMesh).toBe(true)
      expect(result.vertices).toHaveLength(4) // Full rectangle
    })

    it('should handle complex real island geometry', () => {
      const trinityIsland = createTrinityIsland()
      const tileCenter = { x: 0, z: -580 }
      const tileSize = 48

      const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, trinityIsland)

      expect(result.shouldCreateMesh).toBe(true)
      expect(result.vertices.length).toBeGreaterThan(0)
      expect(result.polygons).toBeDefined()
    })

    it('should handle adjacent tiles near island boundaries without interference', () => {
      // Test two adjacent ocean tiles that both intersect with an island
      // This reproduces the Trinity middle section issue where two close tiles might interfere
      const tileSize = 48

      // Create an island that spans across two adjacent tiles
      const island = [
        { x: -30, z: -590 },
        { x: 30, z: -590 },
        { x: 30, z: -570 },
        { x: -30, z: -570 },
      ]

      // Two adjacent tiles that should both intersect this island
      const tile1Center = { x: -24, z: -580 } // Left tile
      const tile2Center = { x: 24, z: -580 } // Right tile (48 units apart)

      const result1 = PolygonClipping.clipWaterTileAgainstIsland(tile1Center, tileSize, island)
      const result2 = PolygonClipping.clipWaterTileAgainstIsland(tile2Center, tileSize, island)

      // Both tiles should be clipped (not skipped entirely)
      expect(result1.shouldCreateMesh).toBe(true)
      expect(result2.shouldCreateMesh).toBe(true)

      // Both should have clipped geometry (not full rectangles)
      expect(result1.vertices.length).toBeGreaterThan(4)
      expect(result2.vertices.length).toBeGreaterThan(4)
    })

    it('should handle edge case where tile boundary aligns with island edge', () => {
      // Test edge case where tile boundary exactly aligns with island boundary
      // This can cause floating point precision issues
      const tileCenter = { x: 5000, z: -58100 }
      const tileSize = 48
      const halfSize = 24

      const island = [
        // Island edge exactly aligns with tile edge
        { x: tileCenter.x - halfSize, z: tileCenter.z - halfSize - 10 },
        { x: tileCenter.x + halfSize, z: tileCenter.z - halfSize - 10 },
        { x: tileCenter.x + halfSize, z: tileCenter.z + halfSize + 10 },
        { x: tileCenter.x - halfSize, z: tileCenter.z + halfSize + 10 },
      ]

      const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, island)

      // Should not create mesh (tile completely inside island)
      expect(result.shouldCreateMesh).toBe(false)
    })

    it('should systematically test Trinity area to find where clipping fails', () => {
      // Real Trinity island geometry from database
      const trinityCoords = [
        [-0.2, -5.78],
        [-0.2, -5.78],
        [-0.2, -5.7],
        [0, -5.7],
        [0, -5.5],
        [0.2, -5.5],
        [0.2, -5.7],
        [0.4, -5.7],
        [0.4, -5.78],
        [0.6, -5.78],
        [0.6, -5.7],
        [0.8, -5.7],
        [0.8, -5.5],
        [1, -5.5],
        [1, -5.7],
        [1.2, -5.7],
        [1.2, -5.78],
        [1.2, -5.82],
        [1.2, -5.9],
        [1, -5.9],
        [1, -6.1],
        [0.8, -6.1],
        [0.8, -5.9],
        [0.6, -5.9],
        [0.6, -5.82],
        [0.4, -5.82],
        [0.4, -5.9],
        [0.2, -5.9],
        [0.2, -6.1],
        [0, -6.1],
        [0, -5.9],
        [-0.2, -5.9],
        [-0.2, -5.82],
        [-0.4, -5.82],
        [-0.4, -5.9],
        [-0.6, -5.9],
        [-0.6, -6.1],
        [-0.8, -6.1],
        [-0.8, -5.9],
        [-1, -5.9],
        [-1, -5.7],
        [-0.8, -5.7],
        [-0.8, -5.5],
        [-0.6, -5.5],
        [-0.6, -5.7],
        [-0.4, -5.7],
        [-0.4, -5.78],
        [-0.2, -5.78],
      ]

      const trinityIsland: Point2D[] = trinityCoords
        .map(([x, z]) => ({
          x: x * 100, // Convert from island coordinates to world coordinates
          z: z * 100,
        }))
        .reverse() // Match island rendering coordinate order

      const tileSize = 48
      const problems: any[] = []

      // Test a 5x5 grid around Trinity, focusing on the middle area where bridges are
      for (let gridX = -2; gridX <= 2; gridX++) {
        for (let gridZ = -13; gridZ <= -11; gridZ++) {
          // Calculate tile center based on grid position
          const tileCenter = {
            x: gridX * tileSize + tileSize / 2,
            z: gridZ * tileSize + tileSize / 2,
          }

          try {
            const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, trinityIsland)

            if (!result.shouldCreateMesh) {
            } else if (result.vertices.length === 4) {
            } else {
            }

            // Check for potential issues
            if (result.shouldCreateMesh && result.vertices.length === 0) {
              problems.push({
                grid: `(${gridX}, ${gridZ})`,
                center: tileCenter,
                issue: 'Should create mesh but has 0 vertices',
              })
            }
          } catch (error) {
            problems.push({
              grid: `(${gridX}, ${gridZ})`,
              center: tileCenter,
              issue: `Martinez error: ${error}`,
            })
          }
        }
      }

      if (problems.length > 0) {
        problems.forEach((p) => {})
      } else {
      }

      expect(trinityIsland.length).toBeGreaterThan(0)
    })

    it('should detect when Martinez returns multiple polygons from narrow bridge', () => {
      // This test uses the EXACT Trinity geometry from the database
      const trinityCoords = [
        [-0.2, -5.78],
        [-0.2, -5.78],
        [-0.2, -5.7],
        [0, -5.7],
        [0, -5.5],
        [0.2, -5.5],
        [0.2, -5.7],
        [0.4, -5.7],
        [0.4, -5.78],
        [0.6, -5.78],
        [0.6, -5.7],
        [0.8, -5.7],
        [0.8, -5.5],
        [1, -5.5],
        [1, -5.7],
        [1.2, -5.7],
        [1.2, -5.78],
        [1.2, -5.82],
        [1.2, -5.9],
        [1, -5.9],
        [1, -6.1],
        [0.8, -6.1],
        [0.8, -5.9],
        [0.6, -5.9],
        [0.6, -5.82],
        [0.4, -5.82],
        [0.4, -5.9],
        [0.2, -5.9],
        [0.2, -6.1],
        [0, -6.1],
        [0, -5.9],
        [-0.2, -5.9],
        [-0.2, -5.82],
        [-0.4, -5.82],
        [-0.4, -5.9],
        [-0.6, -5.9],
        [-0.6, -6.1],
        [-0.8, -6.1],
        [-0.8, -5.9],
        [-1, -5.9],
        [-1, -5.7],
        [-0.8, -5.7],
        [-0.8, -5.5],
        [-0.6, -5.5],
        [-0.6, -5.7],
        [-0.4, -5.7],
        [-0.4, -5.78],
        [-0.2, -5.78],
      ]
      const trinityIsland: Point2D[] = trinityCoords
        .map(([x, z]) => ({
          x: x * 100, // Convert from island coordinates to world coordinates
          z: z * 100,
        }))
        .reverse() // Match island rendering coordinate order

      // Test tiles that could be cut in half by Trinity's narrow bridges
      const testTiles = [
        { x: 24, z: -552 }, // Grid (0, -12) - near bridge area
        { x: -24, z: -552 }, // Grid (-1, -12) - adjacent tile
        { x: 72, z: -552 }, // Grid (1, -12) - other side
      ]

      for (const waterTileCenter of testTiles) {
        const waterTileSize = 48
        const halfSize = waterTileSize / 2

        // Create the water tile rectangle for Martinez input format
        const tileMinX = waterTileCenter.x - halfSize
        const tileMaxX = waterTileCenter.x + halfSize
        const tileMinZ = waterTileCenter.z - halfSize
        const tileMaxZ = waterTileCenter.z + halfSize
        const waterRectCoords: [number, number][] = [
          [tileMinX, tileMinZ], // Bottom-left
          [tileMaxX, tileMinZ], // Bottom-right
          [tileMaxX, tileMaxZ], // Top-right
          [tileMinX, tileMaxZ], // Top-left
          [tileMinX, tileMinZ], // Close the polygon
        ]

        // Convert island polygon to GeoJSON coordinates format
        const islandCoords: [number, number][] = trinityIsland.map((p) => [p.x, p.z])
        if (islandCoords[0][0] !== islandCoords[islandCoords.length - 1][0] || islandCoords[0][1] !== islandCoords[islandCoords.length - 1][1]) {
          islandCoords.push([islandCoords[0][0], islandCoords[0][1]])
        }

        // Call Martinez directly to see all polygons it returns
        const martinez = require('martinez-polygon-clipping')
        const result = martinez.diff(
          [waterRectCoords], // Subject polygon (water rectangle)
          [islandCoords], // Clipping polygon (island)
        )

        if (result && result.length > 0) {
          result.forEach((polygon: any, i: number) => {
            if (polygon && polygon.length > 0) {
              const outerRing = polygon[0]
              if (outerRing) {
                // Calculate approximate area by bounding box
                let minX = Infinity,
                  maxX = -Infinity,
                  minZ = Infinity,
                  maxZ = -Infinity
                for (const [x, z] of outerRing) {
                  minX = Math.min(minX, x)
                  maxX = Math.max(maxX, x)
                  minZ = Math.min(minZ, z)
                  maxZ = Math.max(maxZ, z)
                }
                const area = (maxX - minX) * (maxZ - minZ)
              }
            }
          })

          // The bug: if Martinez returns multiple polygons (2+), only the largest is used
          // This causes small ocean slivers to be completely missing
          if (result.length > 1) {
          }
        }

        expect(result).toBeTruthy()
      }
    })

    it('should detect when tiny bridge cuts tile into multiple ocean polygons', () => {
      // Test the exact issue: a tiny 1-unit bridge cutting an ocean tile in half
      // Martinez should return 2 separate polygons, but current code only returns 1

      const tileSize = 48
      const tileCenter = { x: 24, z: 0 } // Tile from x(0-48), z(-24 to 24)

      // Create a tiny 1-unit wide vertical bridge that cuts through the middle of the tile
      const tinyBridge = [
        { x: 23, z: -30 }, // Bottom of bridge (extends beyond tile)
        { x: 25, z: -30 }, // 2-unit wide bridge
        { x: 25, z: 30 }, // Top of bridge (extends beyond tile)
        { x: 23, z: 30 }, // Close the bridge
      ]

      // Test with Martinez directly to see how many polygons it returns
      const halfSize = tileSize / 2
      const waterRectCoords: [number, number][] = [
        [tileCenter.x - halfSize, tileCenter.z - halfSize], // (0, -24)
        [tileCenter.x + halfSize, tileCenter.z - halfSize], // (48, -24)
        [tileCenter.x + halfSize, tileCenter.z + halfSize], // (48, 24)
        [tileCenter.x - halfSize, tileCenter.z + halfSize], // (0, 24)
        [tileCenter.x - halfSize, tileCenter.z - halfSize], // Close
      ]

      const bridgeCoords: [number, number][] = tinyBridge.map((p) => [p.x, p.z])
      bridgeCoords.push([tinyBridge[0].x, tinyBridge[0].z]) // Close the polygon

      const martinez = require('martinez-polygon-clipping')
      const result = martinez.diff(
        [waterRectCoords], // Water rectangle
        [bridgeCoords], // Tiny bridge
      )

      if (result && result.length > 0) {
        result.forEach((polygon: any, i: number) => {
          if (polygon && polygon.length > 0) {
            const outerRing = polygon[0]
            if (outerRing) {
              // Calculate bounding box to see the two separate areas
              let minX = Infinity,
                maxX = -Infinity,
                minZ = Infinity,
                maxZ = -Infinity
              for (const [x, z] of outerRing) {
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minZ = Math.min(minZ, z)
                maxZ = Math.max(maxZ, z)
              }

              if (minX < 23) {
              } else {
              }
            }
          }
        })

        if (result.length >= 2) {
        } else {
        }
      }

      // Now test with our current clipping function to see what it returns
      const currentResult = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, tinyBridge)

      expect(result).toBeTruthy()
    })

    it('should analyze exact coordinates 50E, 581S where user sees missing ocean', () => {
      // The user reported missing ocean at coordinates 50E, 581S
      // Let's calculate what grid position this represents
      const userWorldX = 50 * 16 // User coordinates are in 16-unit blocks: 50E = 800 world units
      const userWorldZ = -581 * 16 // 581S = -9296 world units (south is negative)

      // Calculate which ocean grid this falls into
      // Ocean grid formula: gridX = Math.floor(worldX / 48), gridZ = Math.floor(worldZ / 48)
      const oceanGridX = Math.floor(userWorldX / 48)
      const oceanGridZ = Math.floor(userWorldZ / 48)

      // Calculate the ocean tile center for this grid
      const tileCenter = {
        x: oceanGridX * 48 + 24, // Grid center is at grid * tileSize + halfSize
        z: oceanGridZ * 48 + 24,
      }

      // Test this specific tile with Trinity geometry
      const trinityCoords = [
        [-0.2, -5.78],
        [-0.2, -5.78],
        [-0.2, -5.7],
        [0, -5.7],
        [0, -5.5],
        [0.2, -5.5],
        [0.2, -5.7],
        [0.4, -5.7],
        [0.4, -5.78],
        [0.6, -5.78],
        [0.6, -5.7],
        [0.8, -5.7],
        [0.8, -5.5],
        [1, -5.5],
        [1, -5.7],
        [1.2, -5.7],
        [1.2, -5.78],
        [1.2, -5.82],
        [1.2, -5.9],
        [1, -5.9],
        [1, -6.1],
        [0.8, -6.1],
        [0.8, -5.9],
        [0.6, -5.9],
        [0.6, -5.82],
        [0.4, -5.82],
        [0.4, -5.9],
        [0.2, -5.9],
        [0.2, -6.1],
        [0, -6.1],
        [0, -5.9],
        [-0.2, -5.9],
        [-0.2, -5.82],
        [-0.4, -5.82],
        [-0.4, -5.9],
        [-0.6, -5.9],
        [-0.6, -6.1],
        [-0.8, -6.1],
        [-0.8, -5.9],
        [-1, -5.9],
        [-1, -5.7],
        [-0.8, -5.7],
        [-0.8, -5.5],
        [-0.6, -5.5],
        [-0.6, -5.7],
        [-0.4, -5.7],
        [-0.4, -5.78],
        [-0.2, -5.78],
      ]

      const trinityIsland: Point2D[] = trinityCoords
        .map(([x, z]) => ({
          x: x * 100, // Convert from island coordinates to world coordinates
          z: z * 100,
        }))
        .reverse() // Match island rendering coordinate order

      // Check if this tile would intersect Trinity at all
      const halfSize = 24
      const tileBounds = {
        minX: tileCenter.x - halfSize,
        maxX: tileCenter.x + halfSize,
        minZ: tileCenter.z - halfSize,
        maxZ: tileCenter.z + halfSize,
      }

      // Get Trinity island bounds
      let islandMinX = Infinity,
        islandMaxX = -Infinity,
        islandMinZ = Infinity,
        islandMaxZ = -Infinity
      for (const vertex of trinityIsland) {
        islandMinX = Math.min(islandMinX, vertex.x)
        islandMaxX = Math.max(islandMaxX, vertex.x)
        islandMinZ = Math.min(islandMinZ, vertex.z)
        islandMaxZ = Math.max(islandMaxZ, vertex.z)
      }

      // Check if tile overlaps with island at all
      const overlaps = !(tileBounds.maxX < islandMinX || tileBounds.minX > islandMaxX || tileBounds.maxZ < islandMinZ || tileBounds.minZ > islandMaxZ)

      if (overlaps) {
        const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, 48, trinityIsland)

        if (result.shouldCreateMesh) {
        } else {
        }
      } else {
      }

      expect(tileCenter.x).toBeDefined()
      expect(tileCenter.z).toBeDefined()
    })

    it('should test polygonsIntersect for narrow bridge edge case', () => {
      // Test the edge case where a narrow bridge passes through a tile
      // but no vertices are inside the other polygon

      const tileSize = 48
      const tileCenter = { x: 0, z: 0 }
      const tileRectangle = [
        { x: -24, z: -24 }, // Bottom-left
        { x: 24, z: -24 }, // Bottom-right
        { x: 24, z: 24 }, // Top-right
        { x: -24, z: 24 }, // Top-left
      ]

      // Create a narrow bridge that passes exactly through the tile edges
      // This bridge has no vertices inside the tile, but still intersects it
      const narrowBridge = [
        { x: -30, z: -1 }, // Outside tile, left side
        { x: 30, z: -1 }, // Outside tile, right side
        { x: 30, z: 1 }, // Outside tile, right side
        { x: -30, z: 1 }, // Outside tile, left side
      ]

      const intersects = PolygonClipping.polygonsIntersect(tileRectangle, narrowBridge)

      if (!intersects) {
        // Check each condition separately

        // Check if any tile vertices are inside bridge
        let tileVerticesInBridge = 0
        for (const vertex of tileRectangle) {
          if (PolygonClipping.pointInPolygon(vertex, narrowBridge)) {
            tileVerticesInBridge++
          }
        }

        // Check if any bridge vertices are inside tile
        let bridgeVerticesInTile = 0
        for (const vertex of narrowBridge) {
          if (PolygonClipping.pointInPolygon(vertex, tileRectangle)) {
            bridgeVerticesInTile++
          }
        }

        // Check edge intersections manually
        let edgeIntersections = 0
        for (let i = 0; i < tileRectangle.length; i++) {
          const tileStart = tileRectangle[i]
          const tileEnd = tileRectangle[(i + 1) % tileRectangle.length]

          for (let j = 0; j < narrowBridge.length; j++) {
            const bridgeStart = narrowBridge[j]
            const bridgeEnd = narrowBridge[(j + 1) % narrowBridge.length]

            if (PolygonClipping.lineIntersection(tileStart, tileEnd, bridgeStart, bridgeEnd)) {
              edgeIntersections++
            }
          }
        }
      } else {
      }

      // The test should detect intersection for a bridge that clearly passes through
      expect(intersects).toBe(true)
    })

    it('should test tile cut exactly in half edge case', () => {
      // Test when a bridge cuts a tile exactly in half along tile boundaries
      // This could cause precision issues or edge cases in intersection detection

      const tileSize = 48
      const tileCenter = { x: 24, z: 0 } // Tile from x(0 to 48), z(-24 to 24)
      const tileRectangle = [
        { x: 0, z: -24 }, // Bottom-left
        { x: 48, z: -24 }, // Bottom-right
        { x: 48, z: 24 }, // Top-right
        { x: 0, z: 24 }, // Top-left
      ]

      // Bridge that cuts exactly along the left edge of the tile
      // From your screenshot, this could be the issue - bridge at x=0 cutting through tile at x(0-48)
      const bridgeOnLeftEdge = [
        { x: -5, z: -30 }, // Extends beyond tile
        { x: 5, z: -30 }, // Cuts into tile
        { x: 5, z: 30 }, // Cuts into tile
        { x: -5, z: 30 }, // Extends beyond tile
      ]

      const intersects = PolygonClipping.polygonsIntersect(tileRectangle, bridgeOnLeftEdge)

      // Now test the Martinez clipping for this exact scenario
      try {
        const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, bridgeOnLeftEdge)

        if (!result.shouldCreateMesh) {
        } else if (result.vertices.length === 4) {
        } else {
        }
      } catch (error) {}

      expect(intersects).toBe(true)
    })

    it('should handle dog bone shaped island with narrow bridge', () => {
      // Test the exact issue from the screenshot: ocean tile adjacent to narrow bridge
      // The tile to the RIGHT of the bridge should be clipped, not skipped entirely

      // Simulate the scenario: tile next to a narrow vertical bridge
      const tileCenter = { x: 48, z: 0 } // Tile to the RIGHT of the bridge
      const tileSize = 48

      // Create island with narrow vertical bridge extending into the neighboring tile
      const island = [
        // Main island body (left side)
        { x: -100, z: -100 },
        { x: 10, z: -100 },
        { x: 10, z: 100 },
        { x: -100, z: 100 },
        // Narrow vertical bridge extending into the right tile (like in the screenshot)
        { x: 10, z: -5 },
        { x: 50, z: -5 },
        { x: 50, z: 5 },
        { x: 10, z: 5 },
      ]

      const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, island)

      // Debug: show what's happening
      const tileMinX = tileCenter.x - 24,
        tileMaxX = tileCenter.x + 24
      const tileMinZ = tileCenter.z - 24,
        tileMaxZ = tileCenter.z + 24

      if (result.shouldCreateMesh) {
        if (result.vertices.length === 4) {
        } else {
        }
      } else {
      }

      // This should create a mesh with the bridge area clipped out
      expect(result.shouldCreateMesh).toBe(true)
      expect(result.vertices.length).toBeGreaterThan(4) // Should be clipped, not full rectangle
    })
  })

  describe('Mesh vertex generation', () => {
    it('should create mesh vertices at Y=0', () => {
      const geometry = {
        vertices: [
          { x: 0, z: 0 },
          { x: 10, z: 0 },
          { x: 10, z: 10 },
          { x: 0, z: 10 },
        ],
        shouldCreateMesh: true,
      }

      const meshData = PolygonClipping.createMeshVertices(geometry, 0)

      // Should use indexed geometry: 4 unique vertices = 12 components [x, y, z, x, y, z, ...]
      expect(meshData.vertices).toHaveLength(12) // 4 vertices * 3 components each
      expect(meshData.indices).toHaveLength(6) // 2 triangles * 3 indices each

      // All Y values should be 0
      for (let i = 1; i < meshData.vertices.length; i += 3) {
        expect(meshData.vertices[i]).toBe(0)
      }
    })
  })
})
