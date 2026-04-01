// ABOUTME: Test helper utilities for pump tests
// ABOUTME: Provides BabylonJS test scene setup and mock object creation utilities

import { vi } from 'vitest'
import type { FeatureRecord } from '../../../src/pump/types'

export const TestScene = () => new BABYLON.Scene(new BABYLON.NullEngine())

/**
 * Creates a mock FeatureRecord with minimal valid properties
 */
export function createMockFeature(uuid: string, type = 'cube'): FeatureRecord {
  return {
    uuid,
    type,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  } as FeatureRecord
}

/**
 * Creates a unique mock FeatureRecord that won't be treated as an instance
 * Each feature gets unique properties that are included in the featureKey hash
 */
let uniqueFeatureCounter = 0
export function createUniqueFeature(uuid: string, type = 'cube'): FeatureRecord {
  uniqueFeatureCounter++

  const baseFeature = {
    uuid,
    type,
    position: { x: 0, y: 0, z: 0 }, // Excluded from hash
    rotation: { x: 0, y: 0, z: 0 }, // Excluded from hash
    scale: { x: 1, y: 1, z: 1 }, // Excluded from hash
  } as FeatureRecord

  // Add unique properties that ARE included in the featureKey hash
  switch (type) {
    case 'cube':
      return {
        ...baseFeature,
        color: `#${(uniqueFeatureCounter * 123456).toString(16).padStart(6, '0')}`, // Unique color
      } as FeatureRecord

    case 'image':
      return {
        ...baseFeature,
        url: `https://example.com/image-${uniqueFeatureCounter}.png`, // Unique URL
      } as FeatureRecord

    case 'vox-model':
      return {
        ...baseFeature,
        url: `https://example.com/model-${uniqueFeatureCounter}.vox`, // Unique URL
      } as FeatureRecord

    case 'megavox':
      return {
        ...baseFeature,
        url: `https://example.com/megavox-${uniqueFeatureCounter}.vox`, // Unique URL
      } as FeatureRecord

    default:
      // For other types, add a unique blend mode or other property
      return {
        ...baseFeature,
        url: `https://example.com/image-${uniqueFeatureCounter}.png`, // Unique URL
      } as FeatureRecord
  }
}

/**
 * Creates a mock parcel with standard test properties
 */
export function createMockParcel(id = 1) {
  return {
    id,
    transform: { position: { x: 0, y: 0, z: 0 } },
    createFeature: vi.fn(async (feature) => ({
      uuid: feature.uuid,
      type: feature.type,
      dispose: vi.fn(),
    })),
  } as any
}
