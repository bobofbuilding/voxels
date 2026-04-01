import { GraphicEngine } from '../graphic/graphic-engine'
import { DrawDistance } from '../graphic/draw-distance'
import { Scene, SceneConfig } from '../scene'
import { isMobile } from '../../common/helpers/detector'
import { overrideClearCachedVertexData } from '../vendor/clear-cached-patch'
import { VoxImporter } from '../../common/vox-import/vox-import'
import type { FOV } from '../graphic/field-of-view'
import type { CameraSettings } from '../controls/user-control-settings'

export const createScene = (engine: BABYLON.Engine, graphic: GraphicEngine, draw: DrawDistance, config: SceneConfig, fov: FOV, cameraSettings: CameraSettings) => {
  // note: this is our own custom Scene object, not BABYLON's default
  const vi = new VoxImporter()
  const scene = new Scene(engine, graphic, draw, vi, config, fov, cameraSettings, {
    useMaterialMeshMap: true,
    useGeometryUniqueIdsMap: true,
    useClonedMeshMap: true,
  })
  // setting to intermediate causes gifs to not animate on Firefox
  scene.performancePriority = BABYLON.ScenePerformancePriority.BackwardCompatible
  // fix pointer lock movement when mouse down in firefox
  scene.preventDefaultOnPointerDown = false
  scene.preventDefaultOnPointerUp = false

  scene.resetLastAnimationTimeFrame()
  scene.actionManager = new BABYLON.ActionManager(scene)

  scene.autoClear = false
  scene.autoClearDepthAndStencil = false
  // Collisions are enabled
  scene.collisionsEnabled = true

  if (isMobile()) {
    // Only delete vertex data for things that aren't collidable
    overrideClearCachedVertexData(scene)
  }

  return scene
}
