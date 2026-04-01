import { CompletedRawVoxelizedMeshData, VoxelisationJob } from './voxel-field'
import parcelMesher from '../common/voxels/mesher'
import { getBufferFromVoxels } from '../common/voxels/helpers'
import * as Comlink from 'comlink'

export interface VoxelWorkerAPI {
  processVoxelisation(data: VoxelisationJob): Promise<CompletedRawVoxelizedMeshData>
}

const WHITE_BLOCK = (1 << 15) + 3

class VoxelWorker implements VoxelWorkerAPI {
  async processVoxelisation(data: VoxelisationJob): Promise<CompletedRawVoxelizedMeshData> {
    const voxelBuffer = getBufferFromVoxels(data)
    const textureId = data.island == 'Igloo' ? WHITE_BLOCK : undefined

    if (voxelBuffer) {
      // If field contains only zeros, return empty mesh data
      if (!voxelBuffer.data.some((val) => val !== 0)) {
        return {
          renderJob: data.renderJob,
          opaquePositions: new Float32Array(0),
          opaqueIndices: new Uint32Array(0),
          opaqueNormals: new Float32Array(0),
          ambientOcclusion: new Float32Array(0),
          opaqueTextureIndices: new Float32Array(0),
          glassPositions: new Float32Array(0),
          glassIndices: new Uint32Array(0),
          glassNormals: new Float32Array(0),
          colliderPositions: new Float32Array(0),
          colliderIndices: new Uint32Array(0),
          colliderNormals: new Float32Array(0),
        }
      }
      return Object.assign({ renderJob: data.renderJob }, parcelMesher(data.fieldShape, voxelBuffer, textureId))
    }
    throw new Error('No voxel buffer generated for renderJob ' + data.renderJob)
  }
}

export const voxelWorker = new VoxelWorker()

if (typeof self !== 'undefined' && 'postMessage' in self) {
  Comlink.expose(voxelWorker)
}
