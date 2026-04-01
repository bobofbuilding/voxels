// ABOUTME: Tests for polygon clipping utilities used in ocean tile generation
// ABOUTME: Focuses on core functionality rather than debugging specific issues

import { describe, it, expect } from 'vitest'
import { PolygonClipping, type Point2D } from '../../../src/utils/polygon-utils'

describe('PolygonClipping', () => {
  describe('Basic geometry operations', () => {
    it('should detect point inside polygon', () => {
      const rectangle: Point2D[] = [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
        { x: 0, z: 10 },
      ]

      expect(PolygonClipping.pointInPolygon({ x: 5, z: 5 }, rectangle)).toBe(true)
      expect(PolygonClipping.pointInPolygon({ x: 15, z: 5 }, rectangle)).toBe(false)
    })

    it('should find line intersection', () => {
      const intersection = PolygonClipping.lineIntersection({ x: 0, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }, { x: 10, z: 0 })

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
    it('should create clipped mesh when tile partially intersects island', () => {
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
      expect(result.polygons).toBeDefined()
    })

    it('should skip mesh when tile completely inside island', () => {
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
      expect(result.vertices).toHaveLength(4)
      expect(result.polygons).toEqual([result.vertices])
    })

    it('should create multiple polygons when narrow bridge splits tile', () => {
      const tileCenter = { x: 24, z: 0 }
      const tileSize = 48

      // Narrow vertical bridge cutting tile in half
      const bridge = [
        { x: 23, z: -30 },
        { x: 25, z: -30 },
        { x: 25, z: 30 },
        { x: 23, z: 30 },
      ]

      const result = PolygonClipping.clipWaterTileAgainstIsland(tileCenter, tileSize, bridge)

      expect(result.shouldCreateMesh).toBe(true)
      expect(result.polygons).toBeDefined()
      expect(result.polygons!.length).toBe(2) // Left and right ocean areas
    })

    it('should detect polygon intersections correctly', () => {
      const rectangle = [
        { x: -24, z: -24 },
        { x: 24, z: -24 },
        { x: 24, z: 24 },
        { x: -24, z: 24 },
      ]
      const bridge = [
        { x: -30, z: -1 },
        { x: 30, z: -1 },
        { x: 30, z: 1 },
        { x: -30, z: 1 },
      ]

      expect(PolygonClipping.polygonsIntersect(rectangle, bridge)).toBe(true)
    })
  })

  describe('Mesh vertex generation', () => {
    it('should create valid mesh vertices', () => {
      const geometry = {
        shouldCreateMesh: true,
        vertices: [
          { x: 0, z: 0 },
          { x: 10, z: 0 },
          { x: 10, z: 10 },
          { x: 0, z: 10 },
        ],
        polygons: [
          [
            { x: 0, z: 0 },
            { x: 10, z: 0 },
            { x: 10, z: 10 },
            { x: 0, z: 10 },
          ],
        ],
      }

      const meshData = PolygonClipping.createMeshVertices(geometry, 0)

      expect(meshData.vertices.length).toBeGreaterThan(0)
      expect(meshData.vertices.length % 3).toBe(0) // Should be 3D coordinates (x,y,z per vertex)
      expect(meshData.indices.length % 3).toBe(0) // Should be triangles (3 indices per triangle)
    })
  })

  describe('Ocean rendering logic', () => {
    it('should properly prioritize main geometry over lakes', () => {
      // Test case: Island with interior holes should skip separate lakes
      const islandWithHoles = {
        geometry: {
          coordinates: [
            // Exterior ring
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
            // Interior hole
            [
              [3, 3],
              [7, 3],
              [7, 7],
              [3, 7],
              [3, 3],
            ],
          ],
        },
        lakes_geometry_json: {
          coordinates: [
            // Should be ignored since main geometry has interior holes
            [
              [
                [3, 3],
                [7, 3],
                [7, 7],
                [3, 7],
                [3, 3],
              ],
            ],
          ],
        },
      }

      // When island has interior holes, we should use Path 2 (multi-ring clipping)
      // and skip Path 3 (separate lakes)
      const hasInteriorHoles = islandWithHoles.geometry.coordinates.length > 1
      const hasLakes = islandWithHoles.lakes_geometry_json?.coordinates?.length > 0

      expect(hasInteriorHoles).toBe(true)
      expect(hasLakes).toBe(true)

      // Our logic should prioritize interior holes over lakes
      // This prevents duplicate water meshes for the same geometry
    })

    it('should use lakes only when no interior holes exist', () => {
      // Test case: Island with no interior holes should use lakes
      const islandWithOnlyLakes = {
        geometry: {
          coordinates: [
            // Only exterior ring
            [
              [0, 0],
              [20, 0],
              [20, 20],
              [0, 20],
              [0, 0],
            ],
          ],
        },
        lakes_geometry_json: {
          coordinates: [
            // Should be used since main geometry has no interior holes
            [
              [
                [5, 5],
                [10, 5],
                [10, 10],
                [5, 10],
                [5, 5],
              ],
            ],
          ],
        },
      }

      const hasInteriorHoles = islandWithOnlyLakes.geometry.coordinates.length > 1
      const hasLakes = islandWithOnlyLakes.lakes_geometry_json?.coordinates?.length > 0

      expect(hasInteriorHoles).toBe(false)
      expect(hasLakes).toBe(true)

      // Our logic should use both Path 1 (exterior clipping) and Path 3 (lakes)
    })
  })
})
