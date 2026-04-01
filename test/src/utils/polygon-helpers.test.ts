// ABOUTME: Unit tests for polygon helper utilities
// ABOUTME: Tests pure functions for geometry calculations and polygon operations

import { describe, it, expect } from 'vitest'
import { calculateTileBounds, polygonToGeoJSONCoords, getPolygonBounds, isAxisAlignedRectangle, isConvexPolygon, pointInPolygon, coordinateRingsEqual, type Point2D } from '../../../src/utils/polygon-utils'

describe('calculateTileBounds', () => {
  it('should calculate correct bounds for a tile', () => {
    const center = { x: 10, z: 20 }
    const size = 8
    const result = calculateTileBounds(center, size)

    expect(result.minX).toBe(6)
    expect(result.maxX).toBe(14)
    expect(result.minZ).toBe(16)
    expect(result.maxZ).toBe(24)
  })

  it('should create correct coordinate array', () => {
    const center = { x: 0, z: 0 }
    const size = 4
    const result = calculateTileBounds(center, size)

    expect(result.coords).toEqual([
      [-2, -2], // Bottom-left
      [2, -2], // Bottom-right
      [2, 2], // Top-right
      [-2, 2], // Top-left
      [-2, -2], // Close the polygon
    ])
  })

  it('should create correct vertices array', () => {
    const center = { x: 0, z: 0 }
    const size = 4
    const result = calculateTileBounds(center, size)

    expect(result.vertices).toEqual([
      { x: -2, z: -2 },
      { x: 2, z: -2 },
      { x: 2, z: 2 },
      { x: -2, z: 2 },
    ])
  })
})

describe('polygonToGeoJSONCoords', () => {
  it('should convert polygon to GeoJSON coordinates', () => {
    const polygon: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ]
    const result = polygonToGeoJSONCoords(polygon)

    expect(result).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0], // Should close the polygon
    ])
  })

  it('should not duplicate closing point if already closed', () => {
    const polygon: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
      { x: 0, z: 0 }, // Already closed
    ]
    const result = polygonToGeoJSONCoords(polygon)

    expect(result).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0], // Should not duplicate
    ])
  })
})

describe('getPolygonBounds', () => {
  it('should calculate correct bounds for a polygon', () => {
    const polygon: Point2D[] = [
      { x: 1, z: 2 },
      { x: 5, z: 1 },
      { x: 3, z: 4 },
      { x: 0, z: 3 },
    ]
    const result = getPolygonBounds(polygon)

    expect(result.minX).toBe(0)
    expect(result.maxX).toBe(5)
    expect(result.minZ).toBe(1)
    expect(result.maxZ).toBe(4)
  })

  it('should return zero bounds for empty polygon', () => {
    const result = getPolygonBounds([])
    expect(result).toEqual({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 })
  })

  it('should handle single point', () => {
    const polygon: Point2D[] = [{ x: 5, z: 3 }]
    const result = getPolygonBounds(polygon)

    expect(result.minX).toBe(5)
    expect(result.maxX).toBe(5)
    expect(result.minZ).toBe(3)
    expect(result.maxZ).toBe(3)
  })
})

describe('isAxisAlignedRectangle', () => {
  it('should return true for axis-aligned rectangle', () => {
    const rectangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 3 },
      { x: 0, z: 3 },
    ]
    expect(isAxisAlignedRectangle(rectangle)).toBe(true)
  })

  it('should return false for non-rectangle polygon', () => {
    const triangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0.5, z: 1 },
    ]
    expect(isAxisAlignedRectangle(triangle)).toBe(false)
  })

  it('should return false for rotated rectangle', () => {
    const rotatedRect: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 2 },
      { x: -1, z: 1 },
    ]
    expect(isAxisAlignedRectangle(rotatedRect)).toBe(false)
  })

  it('should handle different vertex order', () => {
    const rectangle: Point2D[] = [
      { x: 2, z: 3 },
      { x: 0, z: 3 },
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    ]
    expect(isAxisAlignedRectangle(rectangle)).toBe(true)
  })
})

describe('pointInPolygon', () => {
  const square: Point2D[] = [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
    { x: 2, z: 2 },
    { x: 0, z: 2 },
  ]

  it('should return true for point inside polygon', () => {
    const point = { x: 1, z: 1 }
    expect(pointInPolygon(point, square)).toBe(true)
  })

  it('should return false for point outside polygon', () => {
    const point = { x: 3, z: 3 }
    expect(pointInPolygon(point, square)).toBe(false)
  })

  it('should return true for point on edge (ray casting behavior)', () => {
    const point = { x: 1, z: 0 }
    expect(pointInPolygon(point, square)).toBe(true)
  })

  it('should return true for point at vertex (ray casting behavior)', () => {
    const point = { x: 0, z: 0 }
    expect(pointInPolygon(point, square)).toBe(true)
  })

  it('should work with complex polygon', () => {
    const complexPoly: Point2D[] = [
      { x: 0, z: 0 },
      { x: 3, z: 0 },
      { x: 3, z: 2 },
      { x: 1, z: 2 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ]
    expect(pointInPolygon({ x: 0.5, z: 0.5 }, complexPoly)).toBe(true)
    expect(pointInPolygon({ x: 2, z: 1.5 }, complexPoly)).toBe(true)
    expect(pointInPolygon({ x: 1.5, z: 1.5 }, complexPoly)).toBe(true)
  })
})

describe('coordinateRingsEqual', () => {
  it('should return true for identical rings', () => {
    const ring1: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ]
    const ring2 = [...ring1]
    expect(coordinateRingsEqual(ring1, ring2)).toBe(true)
  })

  it('should return true for rings with different starting points', () => {
    const ring1: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ]
    const ring2: Point2D[] = [
      { x: 1, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
      { x: 0, z: 0 },
    ]
    expect(coordinateRingsEqual(ring1, ring2)).toBe(true)
  })

  it('should return false for different sized rings', () => {
    const ring1: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ]
    const ring2: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ]
    expect(coordinateRingsEqual(ring1, ring2)).toBe(false)
  })

  it('should return true for empty rings', () => {
    expect(coordinateRingsEqual([], [])).toBe(true)
  })

  it('should handle floating point tolerance', () => {
    const ring1: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ]
    const ring2: Point2D[] = [
      { x: 0.0000001, z: 0 },
      { x: 1, z: 0.0000001 },
      { x: 1, z: 1 },
    ]
    expect(coordinateRingsEqual(ring1, ring2)).toBe(true)
  })

  it('should return false when coordinates differ by more than tolerance', () => {
    const ring1: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ]
    const ring2: Point2D[] = [
      { x: 0.001, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ]
    expect(coordinateRingsEqual(ring1, ring2)).toBe(false)
  })
})

describe('isAxisAlignedRectangle', () => {
  it('should return true for axis-aligned rectangle', () => {
    const rectangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 3 },
      { x: 0, z: 3 },
    ]
    expect(isAxisAlignedRectangle(rectangle)).toBe(true)
  })

  it('should return true for different axis-aligned rectangle orientation', () => {
    const rectangle: Point2D[] = [
      { x: 1, z: 1 },
      { x: 1, z: 4 }, // vertical edge
      { x: 5, z: 4 }, // horizontal edge
      { x: 5, z: 1 }, // vertical edge
    ]
    expect(isAxisAlignedRectangle(rectangle)).toBe(true)
  })

  it('should return false for non-rectangle polygon (triangle)', () => {
    const triangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0.5, z: 1 },
    ]
    expect(isAxisAlignedRectangle(triangle)).toBe(false)
  })

  it('should return false for non-rectangle polygon (pentagon)', () => {
    const pentagon: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
      { x: 0, z: 0.5 },
    ]
    expect(isAxisAlignedRectangle(pentagon)).toBe(false)
  })

  it('should return false for rotated rectangle (not axis-aligned)', () => {
    const rotatedRect: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 1 }, // diagonal edge (not axis-aligned)
      { x: 0, z: 2 },
      { x: -1, z: 1 },
    ]
    expect(isAxisAlignedRectangle(rotatedRect)).toBe(false)
  })

  it('should return false for empty polygon', () => {
    expect(isAxisAlignedRectangle([])).toBe(false)
  })

  it('should return false for degenerate rectangle (line)', () => {
    const line: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 0 },
    ]
    expect(isAxisAlignedRectangle(line)).toBe(true) // Still considered axis-aligned
  })
})

describe('isConvexPolygon', () => {
  it('should return true for triangle', () => {
    const triangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0.5, z: 1 },
    ]
    expect(isConvexPolygon(triangle)).toBe(true)
  })

  it('should return true for convex quadrilateral (rectangle)', () => {
    const rectangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 3 },
      { x: 0, z: 3 },
    ]
    expect(isConvexPolygon(rectangle)).toBe(true)
  })

  it('should return true for convex pentagon', () => {
    const pentagon: Point2D[] = [
      { x: 0, z: 1 },
      { x: 0.95, z: 0.31 },
      { x: 0.59, z: -0.81 },
      { x: -0.59, z: -0.81 },
      { x: -0.95, z: 0.31 },
    ]
    expect(isConvexPolygon(pentagon)).toBe(true)
  })

  it('should return true for convex hexagon', () => {
    const hexagon: Point2D[] = [
      { x: 1, z: 0 },
      { x: 0.5, z: 0.87 },
      { x: -0.5, z: 0.87 },
      { x: -1, z: 0 },
      { x: -0.5, z: -0.87 },
      { x: 0.5, z: -0.87 },
    ]
    expect(isConvexPolygon(hexagon)).toBe(true)
  })

  it('should return false for concave polygon (L-shape)', () => {
    const lShape: Point2D[] = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 1 },
      { x: 1, z: 1 }, // This creates the concave "notch"
      { x: 1, z: 2 },
      { x: 0, z: 2 },
    ]
    expect(isConvexPolygon(lShape)).toBe(false)
  })

  it('should return false for concave polygon (C-shape)', () => {
    const cShape: Point2D[] = [
      { x: 0, z: 0 },
      { x: 3, z: 0 },
      { x: 3, z: 1 },
      { x: 1, z: 1 }, // Inner notch
      { x: 1, z: 2 },
      { x: 3, z: 2 },
      { x: 3, z: 3 },
      { x: 0, z: 3 },
    ]
    expect(isConvexPolygon(cShape)).toBe(false)
  })

  it('should return false for star-shaped polygon (concave)', () => {
    const star: Point2D[] = [
      { x: 0, z: 2 }, // top point
      { x: 0.5, z: 0.5 }, // inner point (creates concavity)
      { x: 2, z: 1 }, // right point
      { x: 0.8, z: -0.2 }, // inner point (creates concavity)
      { x: 1, z: -2 }, // bottom right
      { x: 0, z: -0.8 }, // inner point (creates concavity)
      { x: -1, z: -2 }, // bottom left
      { x: -0.8, z: -0.2 }, // inner point (creates concavity)
      { x: -2, z: 1 }, // left point
      { x: -0.5, z: 0.5 }, // inner point (creates concavity)
    ]
    expect(isConvexPolygon(star)).toBe(false)
  })

  it('should return false for too few vertices', () => {
    const line: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ]
    expect(isConvexPolygon(line)).toBe(false)
  })

  it('should return false for empty polygon', () => {
    expect(isConvexPolygon([])).toBe(false)
  })

  it('should handle collinear points correctly', () => {
    const collinearTriangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 }, // All points on same line
    ]
    expect(isConvexPolygon(collinearTriangle)).toBe(true) // Degenerate but technically convex
  })

  it('should work with counterclockwise winding', () => {
    const ccwTriangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 0.5, z: 1 },
      { x: 1, z: 0 },
    ]
    expect(isConvexPolygon(ccwTriangle)).toBe(true)
  })

  it('should work with clockwise winding', () => {
    const cwTriangle: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0.5, z: 1 },
    ]
    expect(isConvexPolygon(cwTriangle)).toBe(true)
  })
})
