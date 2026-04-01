import type { FeatureRecord, SortableFeature, InstanceRelation, LoadOrderItem, InstanceRelationMap } from './types'
import { workerIdentifyInstances, workerCreateLoadOrderWithSortableFeatures } from './worker-functions'
import * as Comlink from 'comlink'

const { UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS } = require('../../vendor/library/urls.js')

// Import Babylon.js for worker context
if ('function' === typeof importScripts) {
  importScripts(UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS)
}

export interface PumpWorkerAPI {
  requestInstanceIdentification(features: FeatureRecord[]): Promise<InstanceRelationMap>
  requestFeatureSorting(
    features: SortableFeature[],
    instanceRelations: InstanceRelation[],
    cameraPosition: [number, number, number],
    cameraDirection: [number, number, number],
    maxDrawDistance?: number,
    currentParcelId?: number,
  ): Promise<LoadOrderItem[]>
}

// Helper function to reduce repetitive timing code
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

class PumpWorker implements PumpWorkerAPI {
  async requestInstanceIdentification(features: FeatureRecord[]): Promise<InstanceRelationMap> {
    if (!Array.isArray(features)) {
      throw new Error('Invalid features array')
    }

    const instanceRelations = workerIdentifyInstances(features)

    // Convert array format to Map format expected by the manager
    const map: InstanceRelationMap = new Map()
    for (const [instanceUuid, baseUuid] of instanceRelations) {
      map.set(instanceUuid, baseUuid)
    }

    return map
  }

  async requestFeatureSorting(
    features: SortableFeature[],
    instanceRelations: InstanceRelation[],
    cameraPosition: [number, number, number],
    cameraDirection: [number, number, number],
    maxDrawDistance = 200,
    currentParcelId?: number,
  ): Promise<LoadOrderItem[]> {
    if (!Array.isArray(features)) {
      throw new Error('Invalid features array')
    }

    if (!Array.isArray(instanceRelations)) {
      throw new Error('Invalid instanceRelations array')
    }

    if (!Array.isArray(cameraPosition) || cameraPosition.length !== 3) {
      throw new Error('Invalid camera position - must be [x, y, z] array')
    }

    if (!Array.isArray(cameraDirection) || cameraDirection.length !== 3) {
      throw new Error('Invalid camera direction - must be [x, y, z] array')
    }

    if (cameraPosition.some((v: number) => isNaN(v)) || cameraDirection.some((v: number) => isNaN(v))) {
      throw new Error('Camera position or direction contains NaN values')
    }

    const dirLength = Math.sqrt(cameraDirection[0] * cameraDirection[0] + cameraDirection[1] * cameraDirection[1] + cameraDirection[2] * cameraDirection[2])
    if (dirLength === 0) {
      throw new Error('Camera direction cannot be zero vector')
    }

    return workerCreateLoadOrderWithSortableFeatures(features, instanceRelations, cameraPosition, cameraDirection, maxDrawDistance, currentParcelId)
  }
}

export const pumpWorker = new PumpWorker()

if (typeof self !== 'undefined' && 'postMessage' in self) {
  Comlink.expose(pumpWorker)
}
