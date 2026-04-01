import { describe, it, expect } from 'vitest'
import { PolygonClipping } from '../../../src/utils/polygon-utils'

describe('Rectangle Detection Axis Issues', () => {
  it('should detect rectangles consistently regardless of coordinate ranges', () => {
    // Test rectangle along X-axis (wide rectangle)
    const wideRectangle = {
      shouldCreateMesh: true,
      vertices: [
        // Wide rectangle: 4 units wide, 1 unit tall
        { x: 0, z: 0 }, // Bottom-left
        { x: 1, z: 0 }, // Extra on bottom
        { x: 2, z: 0 }, // Extra on bottom
        { x: 3, z: 0 }, // Extra on bottom
        { x: 4, z: 0 }, // Bottom-right
        { x: 4, z: 0.5 }, // Extra on right
        { x: 4, z: 1 }, // Top-right
        { x: 3, z: 1 }, // Extra on top
        { x: 2, z: 1 }, // Extra on top
        { x: 1, z: 1 }, // Extra on top
        { x: 0, z: 1 }, // Top-left
        { x: 0, z: 0.5 }, // Extra on left
      ],
    }

    // Test rectangle along Z-axis (tall rectangle)
    const tallRectangle = {
      shouldCreateMesh: true,
      vertices: [
        // Tall rectangle: 1 unit wide, 4 units tall
        { x: 0, z: 0 }, // Bottom-left
        { x: 0.5, z: 0 }, // Extra on bottom
        { x: 1, z: 0 }, // Bottom-right
        { x: 1, z: 1 }, // Extra on right
        { x: 1, z: 2 }, // Extra on right
        { x: 1, z: 3 }, // Extra on right
        { x: 1, z: 4 }, // Top-right
        { x: 0.5, z: 4 }, // Extra on top
        { x: 0, z: 4 }, // Top-left
        { x: 0, z: 3 }, // Extra on left
        { x: 0, z: 2 }, // Extra on left
        { x: 0, z: 1 }, // Extra on left
      ],
    }

    const wideMeshData = PolygonClipping.createMeshVertices(wideRectangle, 0)

    const tallMeshData = PolygonClipping.createMeshVertices(tallRectangle, 0)

    // Without optimization, earcut will triangulate all vertices
    expect(wideMeshData.vertices.length).toBe(36) // 12 vertices * 3 components
    expect(wideMeshData.indices.length).toBe(30) // 10 triangles * 3 indices

    expect(tallMeshData.vertices.length).toBe(36) // 12 vertices * 3 components
    expect(tallMeshData.indices.length).toBe(30) // 10 triangles * 3 indices
  })

  it('should handle rectangles with different tolerance requirements', () => {
    // Rectangle with vertices that are further from perfect edges
    const sloppyRectangle = {
      shouldCreateMesh: true,
      vertices: [
        { x: 0.05, z: 0.02 }, // Near corner but not exact
        { x: 0.5, z: 0.01 }, // On bottom edge
        { x: 0.95, z: 0.03 }, // Near corner but not exact
        { x: 0.98, z: 0.5 }, // On right edge
        { x: 0.96, z: 0.97 }, // Near corner but not exact
        { x: 0.5, z: 0.99 }, // On top edge
        { x: 0.04, z: 0.98 }, // Near corner but not exact
        { x: 0.02, z: 0.5 }, // On left edge
      ],
    }

    const sloppyMeshData = PolygonClipping.createMeshVertices(sloppyRectangle, 0)

    // Without optimization, earcut triangulates all 8 vertices
    expect(sloppyMeshData.vertices.length).toBe(24) // 8 vertices * 3 components
    expect(sloppyMeshData.indices.length).toBe(18) // 6 triangles * 3 indices
  })
})
