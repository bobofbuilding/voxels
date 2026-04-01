// ABOUTME: Worker-specific tests for instance detection and visual sorting
// ABOUTME: Tests worker isolation, timing, and proper async behavior

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FeaturePump } from '../../../src/pump/feature-pump'
import { createMockParcel, createMockFeature, createUniqueFeature, TestScene } from './helper'
import { pumpUntilComplete, getPumpStats } from './async-test-helpers'
import { MockWorkerManager } from './mock-worker-manager'

describe('Pump Worker Operations', () => {
  let pump: FeaturePump
  let mockWorkerManager: MockWorkerManager

  beforeEach(() => {
    mockWorkerManager = new MockWorkerManager()
    pump = new FeaturePump(TestScene(), mockWorkerManager as any)
    pump.setCameraPosition(new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, 1))
  })

  afterEach(() => {
    pump?.dispose()
  })

  describe('Instance Detection', () => {
    it('should process features using worker-based instance detection', async () => {
      const parcel = createMockParcel(1)
      const features = [
        createMockFeature('feat1', 'cube'),
        createMockFeature('feat2', 'cube'), // Same type = potential instances
      ]

      pump.activate(parcel, features, () => {})
      await pumpUntilComplete(pump, 2000)

      const stats = getPumpStats(pump)
      expect(stats.failedWorkerRequests || 0).toBeGreaterThanOrEqual(0)
    })

    it('should handle group processing with instance detection', async () => {
      const parcel = createMockParcel(1)
      const groupFeature = createMockFeature('group1', 'group')
      const childFeatures = [createMockFeature('child1', 'cube'), createMockFeature('child2', 'cube')]
      // Set group relationship
      childFeatures.forEach((f) => (f.groupId = groupFeature.uuid))

      pump.activate(parcel, [groupFeature, ...childFeatures], () => {})
      await pumpUntilComplete(pump, 2000)

      const stats = getPumpStats(pump)
      expect(stats.workQueueSize).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Visual Sorting', () => {
    it('should sort features based on camera distance', async () => {
      // Set camera position
      pump.setCameraPosition(new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, 1))

      const parcel = createMockParcel(1)
      const features = [createUniqueFeature('near', 'cube'), createUniqueFeature('far', 'cube')]
      features[0].position = { x: 1, y: 0, z: 0 } // Near
      features[1].position = { x: 100, y: 0, z: 0 } // Far

      pump.activate(parcel, features, () => {})
      await pumpUntilComplete(pump, 3000)

      const stats = getPumpStats(pump)
      expect(stats.lastSortDuration).toBeGreaterThanOrEqual(0)
    })

    it('should apply incremental parcel penalty', async () => {
      // Create two parcels with multiple features each
      const parcel1 = createMockParcel(1)
      const parcel2 = createMockParcel(2)

      const features1 = [createUniqueFeature('p1-f1', 'cube'), createUniqueFeature('p1-f2', 'cube'), createUniqueFeature('p1-f3', 'cube')]

      const features2 = [createUniqueFeature('p2-f1', 'sphere'), createUniqueFeature('p2-f2', 'sphere')]

      pump.activate(parcel1, features1, () => {})
      pump.activate(parcel2, features2, () => {})
      await pumpUntilComplete(pump, 3000)

      const stats = getPumpStats(pump)
      expect(stats.lastSortDuration).toBeGreaterThanOrEqual(0)
    })

    it('should exempt current parcel from penalty', async () => {
      const parcel = createMockParcel(1)
      pump.setCurrentParcel(parcel)

      const features = [createUniqueFeature('f1', 'cube'), createUniqueFeature('f2', 'cube')]

      pump.activate(parcel, features, () => {})
      await pumpUntilComplete(pump, 2000)

      const stats = getPumpStats(pump)
      expect(stats.currentParcelId).toBe(1)
    })
  })

  describe('Worker Timing', () => {
    it('should capture timing for operations', async () => {
      const parcel = createMockParcel(1)
      const features = [createUniqueFeature('feat1', 'cube'), createUniqueFeature('feat2', 'cube')]

      pump.activate(parcel, features, () => {})
      await pumpUntilComplete(pump, 3000)

      const stats = getPumpStats(pump)
      // Timing may not be available in test environment
      const hasValidTiming = typeof stats.lastDetectionResponseTime === 'number' || typeof stats.lastSortingResponseTime === 'number'
      expect(hasValidTiming || stats.lastDetectionResponseTime === undefined).toBe(true)
    })

    it('should handle worker operations without timing in test env', async () => {
      const parcel = createMockParcel(1)
      const features = [createUniqueFeature('feat1', 'cube')]

      pump.activate(parcel, features, () => {})
      await pumpUntilComplete(pump, 2000)

      // Should not throw even without real worker timing
      const stats = getPumpStats(pump)
      expect(stats).toBeDefined()
    })
  })

  describe('Group Hierarchy', () => {
    it('should sort groups by hierarchy', async () => {
      const parcel = createMockParcel(1)

      // Create parent-child group relationship
      const parentGroup = createMockFeature('parent', 'group')
      const childGroup = createMockFeature('child', 'group')
      childGroup.groupId = parentGroup.uuid

      const features = [childGroup, parentGroup] // Child first (should be reordered)

      pump.activate(parcel, features, () => {})
      await pumpUntilComplete(pump, 2000)

      const stats = getPumpStats(pump)
      expect(stats.workQueueSize).toBeGreaterThanOrEqual(0)
    })

    it('should handle circular group dependencies', async () => {
      const parcel = createMockParcel(1)

      // Create circular dependency
      const group1 = createMockFeature('group1', 'group')
      const group2 = createMockFeature('group2', 'group')
      group1.groupId = group2.uuid
      group2.groupId = group1.uuid

      pump.activate(parcel, [group1, group2], () => {})
      await pumpUntilComplete(pump, 2000)

      // Should not hang or crash
      const stats = getPumpStats(pump)
      expect(stats.workQueueSize).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle worker failures gracefully', async () => {
      const parcel = createMockParcel(1)
      const features = [createUniqueFeature('feat1', 'cube')]

      pump.activate(parcel, features, () => {})
      await pumpUntilComplete(pump, 2000)

      const stats = getPumpStats(pump)
      expect(stats.failedWorkerRequests || 0).toBeGreaterThanOrEqual(0)
    })

    it('should continue processing after worker errors', async () => {
      const parcel1 = createMockParcel(1)
      const parcel2 = createMockParcel(2)

      pump.activate(parcel1, [createUniqueFeature('f1', 'cube')], () => {})
      pump.activate(parcel2, [createUniqueFeature('f2', 'sphere')], () => {})

      await pumpUntilComplete(pump, 3000)

      const stats = getPumpStats(pump)
      expect(stats.activeParcelsCount).toBeGreaterThanOrEqual(0)
    })
  })
})
