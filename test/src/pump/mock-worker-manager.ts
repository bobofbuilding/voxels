// ABOUTME: Mock WorkerManager implementation for testing pump behavior
// ABOUTME: Uses real worker functions but runs them synchronously instead of in worker

import type { SortableFeature, LoadOrderItem, InstanceRelationMap } from '../../../src/pump/types'
import { workerIdentifyInstances, workerCreateLoadOrderWithSortableFeatures } from '../../../src/pump/worker-functions'

export class MockWorkerManager {
  private state: 'idle' | 'busy' = 'idle'
  private detectionDelay = 0
  private sortingDelay = 0
  private shouldFailDetection = false
  private shouldFailSorting = false

  // Control delays for testing
  setDetectionDelay(ms: number) {
    this.detectionDelay = ms
  }

  setSortingDelay(ms: number) {
    this.sortingDelay = ms
  }

  setFailDetection(fail: boolean) {
    this.shouldFailDetection = fail
  }

  setFailSorting(fail: boolean) {
    this.shouldFailSorting = fail
  }

  getWorkerState() {
    return this.state
  }

  getWorkerStats() {
    return {}
  }

  getDetectionResponseTimes() {
    return []
  }

  getSortingResponseTimes() {
    return []
  }

  getDetectionTimingHistory() {
    return []
  }

  getSortingTimingHistory() {
    return []
  }

  async requestInstanceIdentification(features: Array<{ uuid: string; type: string; groupId?: string }>): Promise<InstanceRelationMap> {
    this.state = 'busy'

    // Simulate processing delay (works with fake timers)
    if (this.detectionDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.detectionDelay))
    }

    this.state = 'idle'

    if (this.shouldFailDetection) {
      throw new Error('Mock detection failure')
    }

    // Use real worker function for instance detection
    const instanceRelationsArray = workerIdentifyInstances(features as any)

    // Convert back to Map format expected by pump
    const instanceRelationsMap = new Map<string, string>()
    for (const relation of instanceRelationsArray) {
      const [featureUuid, baseFeatureUuid] = relation
      instanceRelationsMap.set(featureUuid, baseFeatureUuid)
    }

    return instanceRelationsMap
  }

  async requestFeatureSortingWithVectors(
    features: SortableFeature[],
    instanceRelations: Map<number, Map<string, string>>,
    cameraPosition: BABYLON.Vector3,
    cameraDirection: BABYLON.Vector3,
    maxDrawDistance: number,
    currentParcelId?: number,
  ): Promise<LoadOrderItem[]> {
    this.state = 'busy'

    // Simulate processing delay (works with fake timers)
    if (this.sortingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.sortingDelay))
    }

    this.state = 'idle'

    if (this.shouldFailSorting) {
      throw new Error('Mock sorting failure')
    }

    // Convert instanceRelations to the format expected by worker function
    const instanceRelationsArray: [string, string][] = []
    for (const parcelRelations of instanceRelations.values()) {
      for (const [featureUuid, baseFeatureUuid] of parcelRelations.entries()) {
        instanceRelationsArray.push([featureUuid, baseFeatureUuid])
      }
    }

    // Use real worker function for sorting
    return workerCreateLoadOrderWithSortableFeatures(features, instanceRelationsArray, [cameraPosition.x, cameraPosition.y, cameraPosition.z], [cameraDirection.x, cameraDirection.y, cameraDirection.z], maxDrawDistance, currentParcelId)
  }

  dispose() {
    // Cleanup
  }
}
