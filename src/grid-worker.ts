import * as Comlink from 'comlink'
import { ParcelRecord } from '../common/messages/parcel'
import type { CachedParcelsMessage } from '../common/messages/api-parcels'
import { type BBox, RBush3D } from 'rbush-3d'
import type { FetchOptions } from '../web/src/utils'
import pDefer from 'p-defer'
import { ExponentialBackoff, handleAll, retry } from 'cockatiel'
import { LoadState, GridWorkerParcel } from './grid-worker-parcel'
import type { NdArray } from 'ndarray'
// Removed MeshData import - no longer meshing in worker

const { UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS } = require('../vendor/library/urls.js')

// Create a retry policy that'll try whatever function with a randomized exponential backoff.
// to be used by fetch!
const retryPolicy = retry(handleAll, { backoff: new ExponentialBackoff() })

export type CameraUpdateMessage = {
  type: 'camera'
  position: [number, number, number]
  frustumPlanes?: number[][] // 6 planes, each with 4 values [a, b, c, d] for plane equation ax + by + cz + d = 0
}

export type InitMessage = {
  type: 'init'
  nearbyDistance: number
  unloadDistance: number
}

export type QueryMessage = {
  type: 'query'
  queryId: number
  position: [number, number, number]
}

export type ParcelGeneratedMessage = {
  type: 'parcel-generated'
  parcelId: number
}

export type GridWorkerInput = CameraUpdateMessage | InitMessage | QueryMessage | ParcelGeneratedMessage

export type GridWorkerQueryResponse = { type: 'QueryResponse'; queryId: number; parcelIds: number[] }

export type GridWorkerParcelLoaded = {
  type: 'Loaded'
  parcelId: number
  description: ParcelRecord
  fieldBuffer?: NdArray<Uint16Array>
}

export type GridWorkerParcelUnloaded = {
  type: 'Unloaded'
  parcelId: number
}

export type GridWorkerOutput = GridWorkerParcelLoaded | GridWorkerParcelUnloaded | GridWorkerQueryResponse

export type GridWorkerContract = {
  input: GridWorkerInput
  output: GridWorkerOutput
}

export interface GridWorkerAPI {
  init(nearbyDistance: number, unloadDistance: number): void
  cameraUpdate(position: [number, number, number], frustumPlanes?: number[][]): void
  queryParcelsAtPosition(queryId: number, position: [number, number, number]): Promise<{ type: 'QueryResponse'; queryId: number; parcelIds: number[] }>
  handleParcelGenerated(parcelId: number): void
  load(): Promise<void>
  setMessageCallback(callback: (message: GridWorkerOutput) => void): void
}

if ('function' === typeof importScripts) importScripts(UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS)

const MAX_PARCEL_QUEUE_SIZE = 15
const MAX_PARCELS_TO_QUEUE_PER_CYCLE = 10
const RBUSH_MAX_ENTRIES = 10
const DEFAULT_NEARBY_DISTANCE = 20 // these are just conservative defaults -- we used higher on desktop
const DEFAULT_DISTANCE_FROM_TARGET = 20
const DEFAULT_UNLOAD_DISTANCE = 40
const ISOLATE_MODE_DISTANCE = 1

type ParcelBox = {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
  parcel: GridWorkerParcel
}
// RBush3D is not generic so monkeying the types
type ParcelRTree = Omit<RBush3D, 'search' | 'all' | 'load' | 'insert'> & {
  search(bbox: BBox): ParcelBox[]
  all(): ParcelBox[]
  load(data: ParcelBox[]): ParcelRTree
  insert(item?: ParcelBox): ParcelRTree
}

const getSearchBox = (center: BABYLON.Vector3, distance: number): BBox => {
  return {
    minX: center.x - distance,
    minY: center.y - distance,
    minZ: center.z - distance,
    maxX: center.x + distance,
    maxY: center.y + distance,
    maxZ: center.z + distance,
  }
}

class GridWorker implements GridWorkerAPI {
  private messageCallback?: (message: GridWorkerOutput) => void
  parcelLoadingQueue: Set<number> = new Set()
  parcelGenerationQueue: Set<number> = new Set() // Tracks parcels sent to main thread for generation
  public self = { postMessage: (message: GridWorkerOutput, _transfer?: Transferable[]) => this.emit(message) }
  protected parcels: ParcelRTree = new RBush3D(RBUSH_MAX_ENTRIES) as unknown as ParcelRTree
  protected engine: BABYLON.Engine
  protected scene: BABYLON.Scene
  protected camera: BABYLON.Camera
  protected loadDistance = DEFAULT_NEARBY_DISTANCE
  protected unloadDistance = DEFAULT_UNLOAD_DISTANCE
  protected cameraViewDistance = DEFAULT_DISTANCE_FROM_TARGET
  protected loadFinished = false
  private _loadedDeferred = pDefer<void>()
  private frustumPlanes?: number[][]

  constructor() {
    this.engine = new BABYLON.NullEngine()
    this.scene = new BABYLON.Scene(this.engine)
    this.camera = new BABYLON.Camera('grid-worker', BABYLON.Vector3.Zero(), this.scene)
  }

  async load() {
    if (this.loadFinished) throw new Error('GridWorker already loaded')
    // this is very high priority since the world depends on this loading
    const opts: FetchOptions = { priority: 'high' }
    await retryPolicy.execute(async () => {
      const res = await fetch(process.env.ASSET_PATH + `/api/parcels/cached.json`, opts)
      if (!res.ok) throw res
      const response = (await res.json()) as CachedParcelsMessage
      // transform the parcels into a format suitable for the RTree
      const parcelBoxes = response.parcels.map((p): ParcelBox => {
        const parcel = new GridWorkerParcel(this, p)
        return { parcel, maxX: parcel.max.x, maxY: parcel.max.y, maxZ: parcel.max.z, minX: parcel.min.x, minY: parcel.min.y, minZ: parcel.min.z }
      })
      this.parcels.load(parcelBoxes)
      this.loadFinished = true
      this._loadedDeferred.resolve()
    })
  }

  setMessageCallback(callback: (message: GridWorkerOutput) => void) {
    this.messageCallback = callback
  }

  private emit(message: GridWorkerOutput) {
    if (this.messageCallback) {
      this.messageCallback(message)
    } else {
      console.warn('[GridWorker] No message callback set')
    }
  }

  init(nearbyDistance: number, unloadDistance: number) {
    this.loadDistance = nearbyDistance
    this.unloadDistance = unloadDistance
    // ensure that the camera view distance is never smaller than the default distance from target
    this.cameraViewDistance = Math.max(Math.min(this.loadDistance, DEFAULT_DISTANCE_FROM_TARGET), this.loadDistance)
  }

  queryParcelsAtPosition(queryId: number, position: [number, number, number]) {
    return this._loadedDeferred.promise.then(() => {
      const parcelIds = this.getContainingParcels(BABYLON.Vector3.FromArray(position)).map(({ parcel }) => parcel.id)
      return { type: 'QueryResponse' as const, queryId, parcelIds }
    })
  }

  handleParcelGenerated(parcelId: number) {
    // Remove from generation queue - parcel is now fully loaded on main thread
    this.parcelGenerationQueue.delete(parcelId)
  }

  cameraUpdate(position: [number, number, number], frustumPlanes?: number[][]) {
    let moved = false
    if (!this.camera.position.equalsToFloats(position[0], position[1], position[2])) {
      this.camera.position.copyFromFloats(position[0], position[1], position[2])
      moved = true
    }

    // Store frustum planes for visibility testing
    this.frustumPlanes = frustumPlanes

    if (!this.loadFinished) return

    if (moved) this.unloadParcels()
    this.loadParcels()
  }

  unloadParcels() {
    // Get parcels in camera view using frustum culling if available
    const parcelsInCameraView = new Set(this.getParcelsInFrustum().map(({ parcel }) => parcel.id))

    // get all parcels within the unload distance
    const parcelsWithinUnloadDistance = new Set<number>(this.parcels.search(getSearchBox(this.camera.position, this.unloadDistance)).map(({ parcel }) => parcel.id))

    // unload all parcels that not within the unload distance bounds
    for (const { parcel } of this.parcels.all()) {
      if (parcel.loadState === LoadState.None) continue
      // check not in camera view (shouldn't happen but just in case)
      if (parcelsInCameraView.has(parcel.id)) continue
      // check not within the unload distance
      if (parcelsWithinUnloadDistance.has(parcel.id)) continue

      // out of bounds, unload
      parcel.unload()
      this.parcelLoadingQueue.delete(parcel.id)
    }
  }

  loadParcels() {
    // Consider both loading queue and generation queue for throttling
    const totalPendingParcels = this.parcelLoadingQueue.size + this.parcelGenerationQueue.size
    if (this.parcelLoadingQueue.size >= MAX_PARCEL_QUEUE_SIZE || totalPendingParcels >= MAX_PARCEL_QUEUE_SIZE * 2) return

    // only queue up parcels to load at a time (to avoid filling the queue too fast when moving around)
    let count = 0
    for (const { parcel } of this.getParcelsForLoading()) {
      if (count >= MAX_PARCELS_TO_QUEUE_PER_CYCLE || this.parcelLoadingQueue.size >= MAX_PARCEL_QUEUE_SIZE) {
        break
      }
      // skip if already loading or already sent for generation
      if (this.parcelLoadingQueue.has(parcel.id) || this.parcelGenerationQueue.has(parcel.id) || parcel.loadState !== LoadState.None) continue

      this.parcelLoadingQueue.add(parcel.id)
      count++
      parcel.load().finally(() => {
        this.parcelLoadingQueue.delete(parcel.id)
      })
    }
  }

  /**
   * Gets all parcels prioritized for loading, combining both spherical proximity and camera view direction.
   * Returns deduplicated list sorted by distance from camera.
   */
  getParcelsForLoading(): ParcelBox[] {
    // In the "isolate mode", only load parcels within spherical distance
    if (this.loadDistance === ISOLATE_MODE_DISTANCE) {
      return this.sortByDistance(this.getParcelsWithinCircle(this.camera.position, this.loadDistance))
    }

    // Use frustum culling if available, otherwise fall back to forward box
    const viewDirectionParcels = this.sortByDistance(this.getParcelsInFrustum())

    let surroundingParcels = this.sortByDistance(this.getParcelsWithinCircle(this.camera.position, this.loadDistance))
    surroundingParcels = this.deduplicate(surroundingParcels, viewDirectionParcels)
    // we are prioritizing the parcels the 12 closest to the camera, but prioritize the visible parcels first
    const firstPriority = viewDirectionParcels.slice(0, 6)
    const secondPriority = surroundingParcels.slice(0, 6)
    // now we prioritize the other visible parcels
    const thirdPriority = viewDirectionParcels.slice(firstPriority.length)
    // and backfill with the rest of parcels surrounding the camera
    const fourthPriority = surroundingParcels.slice(secondPriority.length)

    return [...firstPriority, ...secondPriority, ...thirdPriority, ...fourthPriority]
  }

  // remove all the parcels from the first array that already exists in the second array
  private deduplicate(list: ParcelBox[], duplicates: ParcelBox[]): ParcelBox[] {
    const seenIds = new Set(duplicates.map((pb) => pb.parcel.id))
    const result: ParcelBox[] = []
    for (const parcelBox of list) {
      if (!seenIds.has(parcelBox.parcel.id)) {
        seenIds.add(parcelBox.parcel.id) // make sure that duplicates in the list are also removed
        result.push(parcelBox)
      }
    }
    return result
  }

  /** Gets parcels visible in the camera frustum using accurate frustum culling */
  private getParcelsInFrustum(): ParcelBox[] {
    // Get all parcels within draw distance to test against frustum
    const candidateParcels = this.getParcelsWithinCircle(this.camera.position, this.loadDistance)

    // Filter parcels that are actually visible in the frustum
    return candidateParcels.filter((parcel) => this.isParcelInFrustum(parcel, this.frustumPlanes))
  }

  /** Gets all parcels within spherical distance from position */
  private getParcelsWithinCircle = (position: BABYLON.Vector3, distance: number): ParcelBox[] => this.parcels.search(getSearchBox(position, distance))

  private getContainingParcels = (pos: BABYLON.Vector3): ParcelBox[] => this.parcels.search({ minX: pos.x, minY: pos.y, minZ: pos.z, maxX: pos.x, maxY: pos.y, maxZ: pos.z })

  /**
   * Sorts parcels by distance from camera position
   */
  private sortByDistance = (parcels: ParcelBox[]): ParcelBox[] => parcels.sort((a, b) => a.parcel.getDistance(this.camera.position) - b.parcel.getDistance(this.camera.position))

  /**
   * Tests if a parcel's bounding box intersects with the camera frustum
   */
  private isParcelInFrustum(parcel: ParcelBox, frustumPlanes?: number[][]): boolean {
    if (!frustumPlanes || frustumPlanes.length === 0) {
      return true // No frustum data, assume visible
    }

    const min = new BABYLON.Vector3(parcel.minX, parcel.minY, parcel.minZ)
    const max = new BABYLON.Vector3(parcel.maxX, parcel.maxY, parcel.maxZ)

    // Test parcel bounding box against all 6 frustum planes
    for (const planeData of frustumPlanes) {
      const plane = new BABYLON.Plane(planeData[0], planeData[1], planeData[2], planeData[3])

      // Get the positive vertex of the AABB relative to the plane normal
      const pVertex = new BABYLON.Vector3(plane.normal.x >= 0 ? max.x : min.x, plane.normal.y >= 0 ? max.y : min.y, plane.normal.z >= 0 ? max.z : min.z)

      // If the positive vertex is outside the plane, the whole box is outside
      if (plane.dotCoordinate(pVertex) < 0) {
        return false
      }
    }
    return true // AABB intersects or is inside the frustum
  }
}

export const gridWorker = new GridWorker()
gridWorker.load()

if (typeof self !== 'undefined' && 'postMessage' in self) {
  Comlink.expose(gridWorker)
}
