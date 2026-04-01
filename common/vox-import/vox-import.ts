import VoxVertexShader from './vox.vsh'
import VoxPixelShader from './vox.fsh'
import type { Scene } from '../../src/scene'
import type { VoxData } from './vox-reader'
import { createComlinkWorker } from '../helpers/comlink-worker'
import type { VoxWorkerAPI } from './vox-worker'

BABYLON.Effect.ShadersStore['VoxVertexShader'] = VoxVertexShader
BABYLON.Effect.ShadersStore['VoxPixelShader'] = VoxPixelShader

type JobRecordCommon = {
  wantCollider: boolean
  renderJob: number
  flipX: boolean
  megavox: boolean
  sizeHint?: Array<number>
  maxTriangles: number
  dryRun: boolean // true to just test against maxTriangles and avoid actually constructing the mesh as far as possible
  timeoutMs: number
}

type UrlJobRecord = JobRecordCommon & {
  url: string
}

type BufferJobRecord = JobRecordCommon & {
  buffer: ArrayBuffer
}

export type JobRecord = UrlJobRecord | BufferJobRecord

//TODO: Estimate these better. Architect Island has megavoxes with > 500000!
export const MAX_TRIANGLES_PER_VOX_MODEL_DISPLAY = 1000000
export const MAX_TRIANGLES_PER_VOX_MODEL_UPLOAD = 150000

type JobsManager = { [x: number]: (data: { renderJob: number } & (VoxData | { error: any })) => void }

export interface Options {
  wantCollider?: boolean // default false
  invertX?: boolean // default false
  megavox?: boolean
  sizeHint?: BABYLON.Vector3
  signal: AbortSignal
  maxTriangles?: number
  dryRun?: boolean // true to just test against maxTriangles and avoid actually constructing the mesh as far as possible
}

export class VoxImporter {
  private static readonly WORKER_COUNT = 4
  private static readonly JOB_TIMEOUT_MS = 5000

  private jobs: JobsManager = {}
  private jobWorkerMap: Map<number, VoxWorkerAPI> = new Map()
  private workerBusyCount: Map<VoxWorkerAPI, number> = new Map()
  private jobIndex = 0
  private material: BABYLON.Material | null = null
  private workers: VoxWorkerAPI[] = []
  private workerCleanups: (() => void)[] = []
  private scene?: Scene | BABYLON.Scene

  initialize(scene: Scene | BABYLON.Scene) {
    this.scene = scene

    if ((this.scene as Scene).disableShaders) {
      const m = new BABYLON.StandardMaterial('materials/vox-model', this.scene)
      m.specularColor.set(0.2, 0.2, 0.2)
      this.material = m
    } else {
      this.material = new BABYLON.ShaderMaterial(
        'vox-model/vox-shader',
        this.scene,
        { vertex: 'Vox', fragment: 'Vox' },
        {
          attributes: ['position', 'color'],
          uniforms: ['world', 'worldViewProjection', 'view', 'projection', 'cameraPosition', 'brightness', 'ambient', 'lightDirection', 'fogColor', 'fogDensity'],
          defines: ['#define IMAGEPROCESSINGPOSTPROCESS'],
        },
      )
    }

    if ('environment' in this.scene && this.material instanceof BABYLON.ShaderMaterial) {
      this.material.setVector3('vLight', this.scene.environment?.sunPosition || new BABYLON.Vector3(0.577, 0.577, -0.577).normalize())
      this.scene.environment?.setShaderParameters(this.material, 1.8)
    }
    this.material.blockDirtyMechanism = true

    // Triple slash comment with #if is for the ifdef-loader plugin: https://www.npmjs.com/package/ifdef-loader
    // so that we can conditionally bundle code. We don't want the server spinning up this web workers.
    /// #if RUNTIME === 'WEB'
    for (let i = 0; i < VoxImporter.WORKER_COUNT; i++) {
      this.createWorker()
    }
    /// #endif
  }

  import(urlOrBuffer: string | ArrayBuffer, options: Options): Promise<BABYLON.Mesh> {
    return new Promise((resolve, reject) => {
      if (!this.scene) {
        console.error('VoxImport.scene missing')
      }
      if (!this.material) {
        console.error('VoxImport.material missing')
      }
      if (options.signal?.aborted) {
        return reject('Aborted')
      }
      const mesh = new BABYLON.Mesh('utils/vox-box', this.scene)
      mesh.material = this.material
      mesh.isPickable = true
      mesh.checkCollisions = false

      const renderJob = Number(this.jobIndex)
      this.jobIndex++

      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          this.cancelJob(renderJob)
          mesh.dispose()
          return reject(new Error('Aborted'))
        })
      }

      this.jobs[renderJob] = (data) => {
        this.cleanupJob(renderJob)

        if ('error' in data) {
          mesh.dispose()
          return reject(data.error)
        }

        if (options.signal?.aborted) {
          mesh.dispose()
          return reject(new Error('Aborted'))
        }

        const { positions, indices, colors } = data as VoxData

        const d = new BABYLON.VertexData()
        d.positions = positions
        d.indices = indices
        d.colors = colors
        d.applyToMesh(mesh)

        mesh.checkCollisions = false
        mesh.refreshBoundingInfo()

        resolve(mesh)
      }

      const sizeHint = [1, 1, 1]

      if (options && 'sizeHint' in options) {
        options.sizeHint?.toArray(sizeHint)
      }

      const voxJob: JobRecord = {
        renderJob,
        ...(urlOrBuffer instanceof ArrayBuffer ? { buffer: urlOrBuffer } : { url: urlOrBuffer }),
        flipX: options && 'invertX' in options ? !!options.invertX : true,
        megavox: options && !!options.megavox,
        sizeHint,
        maxTriangles: options.maxTriangles ?? MAX_TRIANGLES_PER_VOX_MODEL_DISPLAY,
        dryRun: options.dryRun ?? false,
        wantCollider: false,
        timeoutMs: VoxImporter.JOB_TIMEOUT_MS,
      }
      /// #if RUNTIME === 'WEB'
      const worker = this.getFreeWorker()
      this.jobWorkerMap.set(renderJob, worker)
      worker
        .loadVox(voxJob)
        .then((result) => {
          const voxImport = this.jobs[renderJob]
          if (voxImport) {
            // Handle cancelled jobs - just clean up without calling the callback
            if ('cancelled' in result && result.cancelled) {
              this.cleanupJob(renderJob)
              return
            }
            voxImport(result)
          }
        })
        .catch((error) => {
          const voxImport = this.jobs[renderJob]
          if (voxImport) {
            voxImport({ renderJob, error: error.message || error })
          } else {
            throw error
          }
        })
      /// #endif
    })
  }

  private getFreeWorker(): VoxWorkerAPI {
    if (this.workers.length === 0) {
      console.error('no workers for VoxImporter')
      throw new Error('No workers available')
    }

    // Initialize busy counts for new workers
    for (const worker of this.workers) {
      if (!this.workerBusyCount.has(worker)) {
        this.workerBusyCount.set(worker, 0)
      }
    }

    // Find worker with least active jobs
    let leastBusyWorker = this.workers[0]
    let minJobs = this.workerBusyCount.get(leastBusyWorker) || 0

    for (const worker of this.workers) {
      const busyCount = this.workerBusyCount.get(worker) || 0
      if (busyCount < minJobs) {
        minJobs = busyCount
        leastBusyWorker = worker
      }
    }

    // Increment busy count
    this.workerBusyCount.set(leastBusyWorker, minJobs + 1)
    return leastBusyWorker
  }

  private createWorker(): void {
    createComlinkWorker<VoxWorkerAPI>(
      // Webpack 5 recognizes this exact pattern and automatically compiles TypeScript workers to separate bundles
      () => new Worker(new URL('./vox-worker.ts', import.meta.url)),
      () => import('./vox-worker').then(({ voxWorker }) => voxWorker),
      { debug: true, workerName: 'vox-worker' },
    )
      .then(({ worker, cleanup }) => {
        this.workers.push(worker)
        this.workerCleanups.push(cleanup)
        this.workerBusyCount.set(worker, 0)
      })
      .catch((error) => {
        console.error('Failed to load vox worker:', error)
      })
  }

  private cleanupJob(renderJob: number) {
    // Decrement worker busy count
    const worker = this.jobWorkerMap.get(renderJob)
    if (worker && this.workerBusyCount.has(worker)) {
      const currentCount = this.workerBusyCount.get(worker) || 0
      this.workerBusyCount.set(worker, Math.max(0, currentCount - 1))
    }

    // Remove worker mapping and job
    this.jobWorkerMap.delete(renderJob)
    delete this.jobs[renderJob]
  }

  private cancelJob(renderJob: number) {
    // Send cancellation message to the worker handling this job
    const worker = this.jobWorkerMap.get(renderJob)
    if (worker) {
      worker.cancelJob(renderJob)
    }
    this.cleanupJob(renderJob)
  }

  /**
   * Get current worker load statistics for debugging
   */
  public getWorkerStats() {
    const stats = this.workers.map((worker, index) => ({
      workerIndex: index,
      busyJobs: this.workerBusyCount.get(worker) || 0,
    }))

    return {
      totalWorkers: this.workers.length,
      totalActiveJobs: Object.keys(this.jobs).length,
      workerLoads: stats,
    }
  }

  public terminate() {
    // Cancel all pending jobs
    for (const renderJob of Object.keys(this.jobs)) {
      this.cancelJob(Number(renderJob))
    }

    // Clear all maps
    this.jobs = {}
    this.jobWorkerMap.clear()
    this.workerBusyCount.clear()

    // Terminate workers
    this.workerCleanups.forEach((cleanup) => cleanup())
    this.workers = []
    this.workerCleanups = []
  }
}
