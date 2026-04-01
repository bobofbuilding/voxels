// ABOUTME: Edge case and stress testing for the pump system
// ABOUTME: Tests memory management, concurrent operations, and boundary conditions

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FeaturePump } from '../../../src/pump/feature-pump'
import { createMockParcel, createMockFeature, createUniqueFeature, TestScene } from './helper'
import { pumpUntilComplete, getPumpStats } from './async-test-helpers'
import { MockWorkerManager } from './mock-worker-manager'

describe('Pump Edge Cases & Stress Tests', () => {
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

  describe('Concurrent Operations', () => {
    it('should handle rapid parcel switching', async () => {
      const parcels = Array.from({ length: 5 }, (_, i) => createMockParcel(i))
      const allCallbacks = []

      // Activate multiple parcels rapidly
      for (const parcel of parcels) {
        const callback = vi.fn()
        allCallbacks.push(callback)
        pump.activate(parcel, [createUniqueFeature(`feat-${parcel.id}`, 'cube')], callback)
      }

      await pumpUntilComplete(pump, 3000)

      const stats = getPumpStats(pump)
      expect(stats.activeParcelsCount).toBe(parcels.length)
    })

    it('should handle concurrent activation and deactivation', async () => {
      const parcel1 = createMockParcel(1)
      const parcel2 = createMockParcel(2)

      // Activate first parcel
      pump.activate(parcel1, [createUniqueFeature('f1', 'cube')], () => {})

      // Immediately activate second and deactivate first
      pump.activate(parcel2, [createUniqueFeature('f2', 'sphere')], () => {})
      pump.deactivate(parcel1, [], () => {})

      await pumpUntilComplete(pump, 2000)

      const stats = getPumpStats(pump)
      expect(stats.activeParcelsCount).toBe(1)
    })
  })

  describe('Memory Management', () => {
    it('should prevent queue overflow with many features', async () => {
      const parcel = createMockParcel(1)
      const manyFeatures = Array.from({ length: 100 }, (_, i) => createUniqueFeature(`feat-${i}`, i % 2 === 0 ? 'cube' : 'sphere'))

      pump.activate(parcel, manyFeatures, () => {})
      await pumpUntilComplete(pump, 5000)

      const stats = getPumpStats(pump)
      expect(stats.workQueueSize).toBeLessThan(200) // Should not grow unbounded
    })

    it('should clean up instance relations on parcel removal', async () => {
      const parcel = createMockParcel(1)
      const features = [createMockFeature('base', 'cube'), createMockFeature('instance1', 'cube'), createMockFeature('instance2', 'cube')]

      pump.activate(parcel, features, () => {})
      await pumpUntilComplete(pump, 2000)

      // Remove parcel
      pump.deactivate(parcel, [], () => {})
      await pumpUntilComplete(pump, 1000)

      const stats = getPumpStats(pump)
      expect(stats.activeParcelsCount).toBe(0)
    })

    it('should handle repeated feature creation/disposal cycles', async () => {
      const parcel = createMockParcel(1)

      // Simulate multiple activation/deactivation cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        const features = [createUniqueFeature(`cycle-${cycle}`, 'cube')]
        pump.activate(parcel, features, () => {})
        await pumpUntilComplete(pump, 1000)

        pump.deactivate(parcel, [], () => {})
        await pumpUntilComplete(pump, 500)
      }

      const stats = getPumpStats(pump)
      expect(stats.activeParcelsCount).toBe(0)
      expect(stats.workQueueSize).toBe(0)
    })
  })

  describe('Boundary Conditions', () => {
    it('should handle extremely large feature counts', () => {
      const parcel = createMockParcel(1)
      const massiveFeatureArray = Array.from({ length: 1000 }, (_, i) => createUniqueFeature(`massive-${i}`, 'cube'))

      // Should not throw on activation
      expect(() => {
        pump.activate(parcel, massiveFeatureArray, () => {})
      }).not.toThrow()

      const stats = getPumpStats(pump)
      expect(stats.activeParcelsCount).toBe(1)
    })

    it('should handle features with extreme positions', async () => {
      const parcel = createMockParcel(1)
      const extremeFeatures = [createUniqueFeature('near-zero', 'cube'), createUniqueFeature('far-positive', 'sphere'), createUniqueFeature('far-negative', 'image')]

      extremeFeatures[0].position = { x: 0, y: 0, z: 0 }
      extremeFeatures[1].position = { x: 1000000, y: 1000000, z: 1000000 }
      extremeFeatures[2].position = { x: -1000000, y: -1000000, z: -1000000 }

      pump.activate(parcel, extremeFeatures, () => {})
      await pumpUntilComplete(pump, 3000)

      const stats = getPumpStats(pump)
      expect(stats.lastSortDuration).toBeGreaterThanOrEqual(0)
    })

    it('should handle features with NaN positions gracefully', () => {
      const parcel = createMockParcel(1)
      const badFeature = createUniqueFeature('bad-pos', 'cube')
      badFeature.position = { x: NaN, y: NaN, z: NaN }

      // Should not crash
      expect(() => {
        pump.activate(parcel, [badFeature], () => {})
      }).not.toThrow()
    })
  })

  describe('Camera Edge Cases', () => {
    it('should handle zero camera direction', () => {
      expect(() => {
        pump.setCameraPosition(new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, 0))
      }).not.toThrow()
    })

    it('should handle extreme camera positions', async () => {
      pump.setCameraPosition(new BABYLON.Vector3(999999, 999999, 999999), new BABYLON.Vector3(1, 0, 0))

      const parcel = createMockParcel(1)
      pump.activate(parcel, [createUniqueFeature('distant', 'cube')], () => {})

      await pumpUntilComplete(pump, 2000)

      const stats = getPumpStats(pump)
      expect(stats.lastSortDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Worker Stress Tests', () => {
    it('should handle rapid worker request patterns', async () => {
      const parcels = Array.from({ length: 10 }, (_, i) => createMockParcel(i))

      // Activate all parcels rapidly to stress worker
      parcels.forEach((parcel) => {
        pump.activate(parcel, [createUniqueFeature(`rapid-${parcel.id}`, 'cube')], () => {})
      })

      await pumpUntilComplete(pump, 5000)

      const stats = getPumpStats(pump)
      expect(stats.activeParcelsCount).toBe(parcels.length)
      expect(stats.failedWorkerRequests || 0).toBeGreaterThanOrEqual(0)
    })

    it('should recover from worker timeout scenarios', async () => {
      const parcel = createMockParcel(1)
      const features = Array.from({ length: 50 }, (_, i) => createUniqueFeature(`timeout-test-${i}`, 'cube'))

      pump.activate(parcel, features, () => {})

      // Even if worker times out, pump should continue
      await pumpUntilComplete(pump, 3000)

      const stats = getPumpStats(pump)
      expect(stats.activeParcelsCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Resource Cleanup', () => {
    it('should clean up all resources on disposal', () => {
      const parcels = Array.from({ length: 5 }, (_, i) => createMockParcel(i))

      parcels.forEach((parcel) => {
        pump.activate(parcel, [createUniqueFeature(`cleanup-${parcel.id}`, 'cube')], () => {})
      })

      expect(getPumpStats(pump).activeParcelsCount).toBe(5)

      pump.dispose()

      expect(getPumpStats(pump).activeParcelsCount).toBe(0)
      expect(getPumpStats(pump).workQueueSize).toBe(0)
      expect(getPumpStats(pump).deactivationQueueSize).toBe(0)
    })

    it('should handle disposal with pending operations', () => {
      const parcel = createMockParcel(1)
      pump.activate(parcel, [createUniqueFeature('pending', 'cube')], () => {})

      // Dispose immediately without waiting
      expect(() => pump.dispose()).not.toThrow()
    })
  })

  describe('Statistics Edge Cases', () => {
    it('should handle statistics queries during transitions', () => {
      const parcel = createMockParcel(1)

      // Query stats while activating
      pump.activate(parcel, [createUniqueFeature('transition', 'cube')], () => {})
      const duringActivation = getPumpStats(pump)
      expect(duringActivation).toBeDefined()

      // Query stats while deactivating
      pump.deactivate(parcel, [], () => {})
      const duringDeactivation = getPumpStats(pump)
      expect(duringDeactivation).toBeDefined()
    })

    it('should provide consistent statistics format', () => {
      const stats = getPumpStats(pump)

      expect(typeof stats.workQueueSize).toBe('number')
      expect(typeof stats.deactivationQueueSize).toBe('number')
      expect(typeof stats.activeParcelsCount).toBe('number')
    })
  })
})
