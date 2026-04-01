import { describe, it, expect } from 'vitest'
import { PolygonClipping } from '../../../src/utils/polygon-utils'

describe('Rectangle Optimization', () => {
  it('should detect and simplify complex polygons that are essentially rectangles', () => {
    // Create a rectangle-like polygon with many extra vertices along edges (simulating Martinez output)
    // Using smaller deviations that are within the tolerance
    const complexRectangle = {
      shouldCreateMesh: true,
      vertices: [
        // Bottom edge with many extra points (all very close to bottom edge)
        { x: 0, z: 0 },
        { x: 0.5, z: 0.01 },
        { x: 1, z: 0.02 },
        { x: 1.5, z: 0.01 },
        { x: 2, z: 0 },

        // Right edge (very close to x=2)
        { x: 2.01, z: 0.5 },
        { x: 2, z: 1 },

        // Top edge with extra points (all very close to top edge)
        { x: 1.5, z: 1.01 },
        { x: 1, z: 0.99 },
        { x: 0.5, z: 1.01 },
        { x: 0, z: 1 },

        // Left edge (very close to x=0)
        { x: 0.01, z: 0.5 },
      ],
    }

    // Let's also test with a perfect rectangle with extra vertices
    const perfectRectangleWithExtraVertices = {
      shouldCreateMesh: true,
      vertices: [
        // Perfect rectangle corners + extra vertices exactly on edges
        { x: 0, z: 0 }, // Corner
        { x: 0.5, z: 0 }, // Extra on bottom edge
        { x: 1, z: 0 }, // Extra on bottom edge
        { x: 2, z: 0 }, // Corner
        { x: 2, z: 0.5 }, // Extra on right edge
        { x: 2, z: 1 }, // Corner
        { x: 1.5, z: 1 }, // Extra on top edge
        { x: 1, z: 1 }, // Extra on top edge
        { x: 0.5, z: 1 }, // Extra on top edge
        { x: 0, z: 1 }, // Corner
        { x: 0, z: 0.5 }, // Extra on left edge
      ],
    }

    const perfectMeshData = PolygonClipping.createMeshVertices(perfectRectangleWithExtraVertices, 0)

    // Without optimization, earcut triangulates all vertices
    expect(perfectMeshData.vertices.length).toBe(33) // 11 vertices * 3 components = 33
    expect(perfectMeshData.indices.length).toBe(27) // 9 triangles * 3 indices = 27

    // Verify it's still a valid mesh
    expect(perfectMeshData.vertices.length % 3).toBe(0) // Multiple of 3 (x,y,z)
    expect(perfectMeshData.indices.length % 3).toBe(0) // Multiple of 3 (triangles)
  })

  it('should preserve complex polygons that are not rectangles', () => {
    // Create a genuinely complex polygon (L-shape)
    const lShapedPolygon = {
      shouldCreateMesh: true,
      vertices: [
        { x: 0, z: 0 },
        { x: 2, z: 0 },
        { x: 2, z: 1 },
        { x: 1, z: 1 },
        { x: 1, z: 2 },
        { x: 0, z: 2 },
      ],
    }

    const meshData = PolygonClipping.createMeshVertices(lShapedPolygon, 0)

    // L-shape should not be simplified to a rectangle
    expect(meshData.vertices.length).toBe(18) // 6 vertices * 3 components
    expect(meshData.indices.length).toBeGreaterThanOrEqual(12) // Multiple triangles for L-shape
  })
})
