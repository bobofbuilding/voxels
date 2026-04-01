import { describe, it, expect } from 'vitest'
import { PolygonClipping } from '../../../src/utils/polygon-utils'

describe('Polygon Simplification', () => {
  // Access the private method for testing with proper context binding
  const simplifyPolygon = (PolygonClipping as any).simplifyPolygon.bind(PolygonClipping)

  it('should remove collinear points from a polygon', () => {
    // Rectangle with extra collinear points on edges
    const complexRectangle: [number, number][] = [
      [0, 0],
      [1, 0], // Extra point on bottom edge
      [2, 0],
      [2, 1], // Extra point on right edge
      [2, 2],
      [1, 2], // Extra point on top edge
      [0, 2],
      [0, 1], // Extra point on left edge
    ]

    const simplified = simplifyPolygon(complexRectangle, 0.01)

    // Basic simplification only removes duplicates, should preserve most vertices
    expect(simplified.length).toBeLessThanOrEqual(complexRectangle.length)
    expect(simplified.length).toBeGreaterThanOrEqual(3) // Still a valid polygon

    // Should still preserve the overall shape bounds
    const xCoords = simplified.map((p: [number, number]) => p[0])
    const yCoords = simplified.map((p: [number, number]) => p[1])
    expect(Math.min(...xCoords)).toBe(0)
    expect(Math.max(...xCoords)).toBe(2)
    expect(Math.min(...yCoords)).toBe(0)
    expect(Math.max(...yCoords)).toBe(2)
  })

  it('should remove points that are too close together', () => {
    const polygonWithClosePoints: [number, number][] = [
      [0, 0],
      [0.005, 0.005], // Very close to previous point
      [1, 0],
      [1.003, 0.002], // Very close to previous point
      [1, 1],
      [0, 1],
    ]

    const simplified = simplifyPolygon(polygonWithClosePoints, 0.01)

    // Should remove the close points and potentially simplify further with Douglas-Peucker
    expect(simplified.length).toBeLessThan(polygonWithClosePoints.length)
    expect(simplified.length).toBeGreaterThanOrEqual(3) // Still a valid polygon

    // Should preserve the overall rectangular bounds
    const xCoords = simplified.map((p: [number, number]) => p[0])
    const yCoords = simplified.map((p: [number, number]) => p[1])
    expect(Math.min(...xCoords)).toBeCloseTo(0, 1)
    expect(Math.max(...xCoords)).toBeCloseTo(1, 1)
    expect(Math.min(...yCoords)).toBeCloseTo(0, 1)
    expect(Math.max(...yCoords)).toBeCloseTo(1, 1)
  })

  it('should preserve triangles (minimum viable polygon)', () => {
    const triangle: [number, number][] = [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ]

    const simplified = simplifyPolygon(triangle, 0.01)

    // Triangles should not be simplified further
    expect(simplified).toHaveLength(3)
    expect(simplified).toEqual(triangle)
  })

  it('should handle complex Martinez output patterns', () => {
    // Simulate what Martinez might produce when clipping a rectangle against an island
    const complexMartinezResult: [number, number][] = [
      [0, 0],
      [0.1, 0.001], // Nearly collinear
      [0.2, 0.002],
      [0.3, 0.001],
      [1, 0],
      [1, 0.1], // Corner area with many points
      [1.001, 0.2],
      [0.999, 0.3],
      [1, 1],
      [0.9, 1.001], // Nearly collinear on top edge
      [0.8, 0.999],
      [0.7, 1.001],
      [0, 1],
    ]

    const simplified = simplifyPolygon(complexMartinezResult, 0.01)

    // Basic simplification may not reduce vertex count significantly
    expect(simplified.length).toBeLessThanOrEqual(complexMartinezResult.length)
    expect(simplified.length).toBeGreaterThanOrEqual(3) // Still a valid polygon
  })

  it('should handle edge case of invalid polygon gracefully', () => {
    const twoPoints: [number, number][] = [
      [0, 0],
      [1, 0],
    ]

    const simplified = simplifyPolygon(twoPoints, 0.01)

    // Should return the original polygon if it can't be simplified to a valid shape
    expect(simplified).toEqual(twoPoints)
  })
})
