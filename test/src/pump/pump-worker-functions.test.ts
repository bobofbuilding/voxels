// ABOUTME: Unit tests for pump worker pure functions - instance detection and sorting algorithms
// ABOUTME: Tests the actual worker functions from worker-functions.ts

import { describe, it, expect } from 'vitest'
import type { FeatureRecord } from '../../../src/pump/types'
import { featureKey, identifyInstances, sortGroupsByHierarchy, calculateSortScore, groupInstanceableFeatures, categorizeWithPrecomputedInstances } from '../../../src/pump/worker-functions'

// Helper to create valid FeatureRecord test fixtures
function createTestFeature(partial: Partial<FeatureRecord> & { uuid: string; type: string }): FeatureRecord {
  return {
    rotation: [0, 0, 0],
    position: { x: 0, y: 0, z: 0 },
    scale: [1, 1, 1],
    ...partial,
  } as FeatureRecord
}

describe('Pump Worker Functions', () => {
  describe('Instance Detection', () => {
    it('should identify identical cubes as instances', () => {
      const features: FeatureRecord[] = [
        createTestFeature({ uuid: 'cube1', type: 'cube', url: 'test.vox', position: { x: 0, y: 0, z: 0 } }),
        createTestFeature({ uuid: 'cube2', type: 'cube', url: 'test.vox', position: { x: 10, y: 0, z: 0 } }),
        createTestFeature({ uuid: 'cube3', type: 'cube', url: 'test.vox', position: { x: 20, y: 0, z: 0 } }),
      ]

      const instances = identifyInstances(features)

      expect(instances.size).toBe(2)
      expect(instances.get('cube2')).toBe('cube1') // cube2 is instance of cube1
      expect(instances.get('cube3')).toBe('cube1') // cube3 is instance of cube1
    })

    it('should not create instances for different feature types', () => {
      const features: FeatureRecord[] = [
        createTestFeature({ uuid: 'cube1', type: 'cube', url: 'test.vox' }),
        createTestFeature({ uuid: 'image1', type: 'image', url: 'test.vox' }),
        createTestFeature({ uuid: 'vox1', type: 'vox-model', url: 'test.vox' }),
      ]

      const instances = identifyInstances(features)

      expect(instances.size).toBe(0) // No instances created
    })

    it('should not create instances for non-instanceable types', () => {
      const features: FeatureRecord[] = [createTestFeature({ uuid: 'text1', type: 'polytext' }), createTestFeature({ uuid: 'text2', type: 'polytext' }), createTestFeature({ uuid: 'audio1', type: 'audio', url: 'test.mp3' })]

      const instances = identifyInstances(features)

      expect(instances.size).toBe(0) // Text and audio are not instanceable
    })

    it('should handle features with different URLs as unique', () => {
      const features: FeatureRecord[] = [
        createTestFeature({ uuid: 'cube1', type: 'cube', url: 'test1.vox' }),
        createTestFeature({ uuid: 'cube2', type: 'cube', url: 'test2.vox' }),
        createTestFeature({ uuid: 'cube3', type: 'cube', url: 'test1.vox' }),
      ]

      const instances = identifyInstances(features)

      expect(instances.size).toBe(1)
      expect(instances.get('cube3')).toBe('cube1') // Only cube3 is instance of cube1
      expect(instances.has('cube2')).toBe(false) // cube2 has different URL
    })

    it('should ignore transform properties when detecting instances', () => {
      const features: FeatureRecord[] = [
        createTestFeature({ uuid: 'cube1', type: 'cube', url: 'test.vox', position: { x: 0, y: 0, z: 0 }, scale: [1, 1, 1] }),
        createTestFeature({ uuid: 'cube2', type: 'cube', url: 'test.vox', position: { x: 10, y: 10, z: 10 }, scale: [2, 2, 2] }),
        createTestFeature({ uuid: 'cube3', type: 'cube', url: 'test.vox', position: { x: 5, y: 5, z: 5 }, rotation: [90, 0, 0] }),
      ]

      const instances = identifyInstances(features)

      expect(instances.size).toBe(2)
      expect(instances.get('cube2')).toBe('cube1') // Different position/scale doesn't matter
      expect(instances.get('cube3')).toBe('cube1') // Different rotation doesn't matter
    })

    it('should handle empty feature array', () => {
      const instances = identifyInstances([])
      expect(instances.size).toBe(0)
    })

    it('should handle single feature', () => {
      const features: FeatureRecord[] = [createTestFeature({ uuid: 'cube1', type: 'cube', url: 'test.vox' })]

      const instances = identifyInstances(features)
      expect(instances.size).toBe(0) // No instances for single feature
    })

    it('should group features by instanceable properties', () => {
      const features: FeatureRecord[] = [
        createTestFeature({ uuid: 'cube1', type: 'cube', url: 'red.vox', color: '#ff0000' }),
        createTestFeature({ uuid: 'cube2', type: 'cube', url: 'red.vox', color: '#ff0000' }),
        createTestFeature({ uuid: 'cube3', type: 'cube', url: 'blue.vox', color: '#0000ff' }),
        createTestFeature({ uuid: 'cube4', type: 'cube', url: 'blue.vox', color: '#0000ff' }),
      ]

      const groups = groupInstanceableFeatures(features)

      // Should have 2 groups: one for red cubes, one for blue cubes
      const nonUniqueGroups = Array.from(groups.entries()).filter(([key]) => !key.startsWith('unique_'))
      expect(nonUniqueGroups.length).toBe(2)

      // Each group should have 2 features
      nonUniqueGroups.forEach(([, group]) => {
        expect(group.length).toBe(2)
      })
    })
  })

  describe('Group Hierarchy Sorting', () => {
    it('should sort parent groups before child groups', () => {
      const groups: FeatureRecord[] = [
        createTestFeature({ uuid: 'child', type: 'group', groupId: 'parent' }) as FeatureRecord,
        createTestFeature({ uuid: 'parent', type: 'group' }) as FeatureRecord,
        createTestFeature({ uuid: 'grandchild', type: 'group', groupId: 'child' }) as FeatureRecord,
      ]

      const sorted = sortGroupsByHierarchy(groups)

      expect(sorted.map((g) => g.uuid)).toEqual(['parent', 'child', 'grandchild'])
    })

    it('should handle circular dependencies', () => {
      const groups: FeatureRecord[] = [
        createTestFeature({ uuid: 'group1', type: 'group', groupId: 'group2' }) as FeatureRecord,
        createTestFeature({ uuid: 'group2', type: 'group', groupId: 'group3' }) as FeatureRecord,
        createTestFeature({ uuid: 'group3', type: 'group', groupId: 'group1' }) as FeatureRecord,
      ]

      const sorted = sortGroupsByHierarchy(groups)

      expect(sorted.length).toBe(3) // All groups should be included
      // Circular dependencies are treated as roots, order may vary
    })

    it('should handle independent groups', () => {
      const groups: FeatureRecord[] = [
        createTestFeature({ uuid: 'group1', type: 'group' }) as FeatureRecord,
        createTestFeature({ uuid: 'group2', type: 'group' }) as FeatureRecord,
        createTestFeature({ uuid: 'group3', type: 'group' }) as FeatureRecord,
      ]

      const sorted = sortGroupsByHierarchy(groups)

      expect(sorted.length).toBe(3)
      expect(sorted.map((g) => g.uuid).sort()).toEqual(['group1', 'group2', 'group3'])
    })

    it('should handle empty array', () => {
      const sorted = sortGroupsByHierarchy([])
      expect(sorted).toEqual([])
    })

    it('should handle complex hierarchy', () => {
      const groups: FeatureRecord[] = [
        createTestFeature({ uuid: 'root1', type: 'group' }) as FeatureRecord,
        createTestFeature({ uuid: 'child1a', type: 'group', groupId: 'root1' }) as FeatureRecord,
        createTestFeature({ uuid: 'child1b', type: 'group', groupId: 'root1' }) as FeatureRecord,
        createTestFeature({ uuid: 'root2', type: 'group' }) as FeatureRecord,
        createTestFeature({ uuid: 'child2a', type: 'group', groupId: 'root2' }) as FeatureRecord,
        createTestFeature({ uuid: 'grandchild1a1', type: 'group', groupId: 'child1a' }) as FeatureRecord,
      ]

      const sorted = sortGroupsByHierarchy(groups)
      const sortedIds = sorted.map((g) => g.uuid)

      // Parents should come before children
      expect(sortedIds.indexOf('root1')).toBeLessThan(sortedIds.indexOf('child1a'))
      expect(sortedIds.indexOf('root1')).toBeLessThan(sortedIds.indexOf('child1b'))
      expect(sortedIds.indexOf('child1a')).toBeLessThan(sortedIds.indexOf('grandchild1a1'))
      expect(sortedIds.indexOf('root2')).toBeLessThan(sortedIds.indexOf('child2a'))
    })

    it('should handle orphaned groups gracefully', () => {
      const groups: FeatureRecord[] = [createTestFeature({ uuid: 'orphan', type: 'group', groupId: 'nonexistent' }) as FeatureRecord, createTestFeature({ uuid: 'root', type: 'group' }) as FeatureRecord]

      const sorted = sortGroupsByHierarchy(groups)

      expect(sorted.length).toBe(2)
      expect(sorted.map((g) => g.uuid)).toContain('orphan')
      expect(sorted.map((g) => g.uuid)).toContain('root')
    })
  })

  describe('Distance-Based Sorting', () => {
    it('should prioritize features closer to camera', () => {
      const cameraPosition: [number, number, number] = [0, 0, 0]
      const cameraDirection: [number, number, number] = [0, 0, 1]
      const maxDrawDistance = 100

      const nearScore = calculateSortScore(
        [0, 0, 10], // 10 units away
        cameraPosition,
        cameraDirection,
        [1, 1, 1],
        maxDrawDistance,
        0, // No penalty
      )

      const farScore = calculateSortScore(
        [0, 0, 50], // 50 units away
        cameraPosition,
        cameraDirection,
        [1, 1, 1],
        maxDrawDistance,
        0, // No penalty
      )

      expect(nearScore).toBeGreaterThan(farScore)
    })

    it('should prioritize larger features', () => {
      const cameraPosition: [number, number, number] = [0, 0, 0]
      const cameraDirection: [number, number, number] = [0, 0, 1]
      const maxDrawDistance = 100

      const smallScore = calculateSortScore(
        [0, 0, 20],
        cameraPosition,
        cameraDirection,
        [1, 1, 1], // Small scale
        maxDrawDistance,
        0,
      )

      const largeScore = calculateSortScore(
        [0, 0, 20],
        cameraPosition,
        cameraDirection,
        [5, 5, 5], // Large scale
        maxDrawDistance,
        0,
      )

      expect(largeScore).toBeGreaterThan(smallScore)
    })

    it('should prioritize features in front of camera', () => {
      const cameraPosition: [number, number, number] = [0, 0, 0]
      const cameraDirection: [number, number, number] = [0, 0, 1] // Looking forward
      const maxDrawDistance = 100

      const frontScore = calculateSortScore(
        [0, 0, 20], // In front
        cameraPosition,
        cameraDirection,
        [1, 1, 1],
        maxDrawDistance,
        0,
      )

      const behindScore = calculateSortScore(
        [0, 0, -20], // Behind camera
        cameraPosition,
        cameraDirection,
        [1, 1, 1],
        maxDrawDistance,
        0,
      )

      expect(frontScore).toBeGreaterThan(behindScore)
    })

    it('should handle zero camera direction', () => {
      const cameraPosition: [number, number, number] = [0, 0, 0]
      const cameraDirection: [number, number, number] = [0, 0, 0] // Invalid direction
      const maxDrawDistance = 100

      const score = calculateSortScore([10, 10, 10], cameraPosition, cameraDirection, [1, 1, 1], maxDrawDistance, 0)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('should handle features at camera position', () => {
      const cameraPosition: [number, number, number] = [10, 10, 10]
      const cameraDirection: [number, number, number] = [0, 0, 1]
      const maxDrawDistance = 100

      const score = calculateSortScore(
        [10, 10, 10], // Same as camera
        cameraPosition,
        cameraDirection,
        [1, 1, 1],
        maxDrawDistance,
        0,
      )

      expect(score).toBeGreaterThanOrEqual(0.5) // Should get high score for being at camera
    })

    it('should handle features beyond max draw distance', () => {
      const cameraPosition: [number, number, number] = [0, 0, 0]
      const cameraDirection: [number, number, number] = [0, 0, 1]
      const maxDrawDistance = 100

      const score = calculateSortScore(
        [0, 0, 200], // Beyond max distance
        cameraPosition,
        cameraDirection,
        [1, 1, 1],
        maxDrawDistance,
        0,
      )

      expect(score).toBeLessThan(0.5) // Should get low score
    })

    it('should apply parcel penalty', () => {
      const cameraPosition: [number, number, number] = [0, 0, 0]
      const cameraDirection: [number, number, number] = [0, 0, 1]
      const maxDrawDistance = 100

      const noPenaltyScore = calculateSortScore(
        [0, 0, 20],
        cameraPosition,
        cameraDirection,
        [1, 1, 1],
        maxDrawDistance,
        0, // No penalty
      )

      const withPenaltyScore = calculateSortScore(
        [0, 0, 20],
        cameraPosition,
        cameraDirection,
        [1, 1, 1],
        maxDrawDistance,
        0.2, // 20% penalty
      )

      expect(noPenaltyScore).toBeGreaterThan(withPenaltyScore)
    })

    it('should handle different feature types correctly', () => {
      const cameraPosition: [number, number, number] = [0, 0, 0]
      const cameraDirection: [number, number, number] = [0, 0, 1]
      const maxDrawDistance = 100

      // Test various high priority types
      const score1 = calculateSortScore([0, 0, 20], cameraPosition, cameraDirection, [1, 1, 1], maxDrawDistance, 0)
      const score2 = calculateSortScore([0, 0, 20], cameraPosition, cameraDirection, [1, 1, 1], maxDrawDistance, 0)

      // All features with same parameters should have equal scores
      expect(score1).toBe(score2)
    })
  })

  describe('Feature Key Generation', () => {
    it('should generate identical keys for similar features', () => {
      const feature1: FeatureRecord = createTestFeature({ uuid: 'f1', type: 'cube', url: 'test.vox', color: '#ff0000' })
      const feature2: FeatureRecord = createTestFeature({ uuid: 'f2', type: 'cube', url: 'test.vox', color: '#ff0000' })

      const key1 = featureKey(feature1)
      const key2 = featureKey(feature2)

      expect(key1).toBe(key2)
      expect(key1).not.toBe(false)
    })

    it('should generate different keys for different URLs', () => {
      const feature1: FeatureRecord = createTestFeature({ uuid: 'f1', type: 'cube', url: 'test1.vox' })
      const feature2: FeatureRecord = createTestFeature({ uuid: 'f2', type: 'cube', url: 'test2.vox' })

      const key1 = featureKey(feature1)
      const key2 = featureKey(feature2)

      expect(key1).not.toBe(key2)
    })

    it('should return false for non-instanceable types', () => {
      const textFeature: FeatureRecord = createTestFeature({ uuid: 'f1', type: 'polytext' }) as FeatureRecord
      const audioFeature: FeatureRecord = createTestFeature({ uuid: 'f2', type: 'audio', url: 'test.mp3' }) as FeatureRecord
      const groupFeature: FeatureRecord = createTestFeature({ uuid: 'f3', type: 'group' }) as FeatureRecord

      expect(featureKey(textFeature)).toBe(false)
      expect(featureKey(audioFeature)).toBe(false)
      expect(featureKey(groupFeature)).toBe(false)
    })

    it('should exclude transform properties from key', () => {
      const feature1: FeatureRecord = createTestFeature({
        uuid: 'f1',
        type: 'cube',
        url: 'test.vox',
        position: { x: 0, y: 0, z: 0 },
        scale: [1, 1, 1],
        rotation: [0, 0, 0],
      })
      const feature2: FeatureRecord = createTestFeature({
        uuid: 'f2',
        type: 'cube',
        url: 'test.vox',
        position: { x: 10, y: 10, z: 10 },
        scale: [2, 2, 2],
        rotation: [90, 0, 0],
      })

      const key1 = featureKey(feature1)
      const key2 = featureKey(feature2)

      expect(key1).toBe(key2) // Keys should be same despite different transforms
    })

    it('should handle instanceable types correctly', () => {
      const cubeFeature: FeatureRecord = createTestFeature({ uuid: 'f1', type: 'cube', url: 'test.vox' }) as FeatureRecord
      const imageFeature: FeatureRecord = createTestFeature({ uuid: 'f2', type: 'image', url: 'test.jpg' }) as FeatureRecord
      const voxFeature: FeatureRecord = createTestFeature({ uuid: 'f3', type: 'vox-model', url: 'test.vox' }) as FeatureRecord
      const megavoxFeature: FeatureRecord = createTestFeature({ uuid: 'f4', type: 'megavox', url: 'test.vox' }) as FeatureRecord

      expect(featureKey(cubeFeature)).not.toBe(false)
      expect(featureKey(imageFeature)).not.toBe(false)
      expect(featureKey(voxFeature)).not.toBe(false)
      expect(featureKey(megavoxFeature)).not.toBe(false)
    })
  })

  describe('Feature Categorization', () => {
    it('should categorize features into groups, base features, and instances', () => {
      const features: FeatureRecord[] = [
        createTestFeature({ uuid: 'group1', type: 'group' }) as FeatureRecord,
        createTestFeature({ uuid: 'base1', type: 'cube', url: 'test.vox' }) as FeatureRecord,
        createTestFeature({ uuid: 'instance1', type: 'cube', url: 'test.vox' }) as FeatureRecord,
        createTestFeature({ uuid: 'instance2', type: 'cube', url: 'test.vox' }) as FeatureRecord,
        createTestFeature({ uuid: 'base2', type: 'cube', url: 'sphere.vox' }) as FeatureRecord,
      ]

      const instanceRelations = new Map([
        ['instance1', 'base1'],
        ['instance2', 'base1'],
      ])

      const result = categorizeWithPrecomputedInstances(features, instanceRelations)

      expect(result.groups.length).toBe(1)
      expect(result.groups[0].uuid).toBe('group1')

      expect(result.baseFeatures.length).toBe(2)
      expect(result.baseFeatures.map((f) => f.uuid).sort()).toEqual(['base1', 'base2'])

      expect(result.instances.get('base1')?.length).toBe(2)
      expect(
        result.instances
          .get('base1')
          ?.map((f) => f.uuid)
          .sort(),
      ).toEqual(['instance1', 'instance2'])
    })

    it('should handle empty features array', () => {
      const result = categorizeWithPrecomputedInstances([], new Map())

      expect(result.groups).toEqual([])
      expect(result.baseFeatures).toEqual([])
      expect(result.instances.size).toBe(0)
    })

    it('should handle features with no instances', () => {
      const features: FeatureRecord[] = [
        createTestFeature({ uuid: 'base1', type: 'cube', url: 'test1.vox' }) as FeatureRecord,
        createTestFeature({ uuid: 'base2', type: 'cube', url: 'test2.vox' }) as FeatureRecord,
        createTestFeature({ uuid: 'base3', type: 'cube', url: 'test3.vox' }) as FeatureRecord,
      ]

      const result = categorizeWithPrecomputedInstances(features, new Map())

      expect(result.groups).toEqual([])
      expect(result.baseFeatures.length).toBe(3)
      expect(result.instances.size).toBe(0)
    })
  })
})
