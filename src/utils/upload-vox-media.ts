import type { Scene } from '../scene'
import { uploadMedia, UploadMediaResult } from '../../common/helpers/upload-media'
import { MAX_TRIANGLES_PER_VOX_MODEL_UPLOAD } from '../../common/vox-import/vox-import'

/**
 * Runs uploadMedia() after attempting to mesh the vox model, to test that it doesn't contain too many triangles.
 * This lives in a separate file from uploadMedia() because that is needed also by the server, and this pulls in
 * voxImport(), which breaks there.
 */
export async function uploadVoxModelMedia(file: File, megavox: boolean, scene: Scene, signal: AbortSignal = new AbortController().signal): Promise<UploadMediaResult> {
  try {
    // First check that the vox model does not result in too many triangles
    await scene.importVox(await file.arrayBuffer(), { signal, megavox, dryRun: true, maxTriangles: MAX_TRIANGLES_PER_VOX_MODEL_UPLOAD }) // Ignore return value, just testing against thresholds
    return uploadMedia(file)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'An error occurred' }
  }
}
