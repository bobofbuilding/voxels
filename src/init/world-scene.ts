import { wantsGateway } from '../../client/platform'
import { hideGatewayBackdrop } from '../gateway'
import Skybox from '../terrain/skybox'
import { Terrain } from '../terrain/terrain'
import { createEvent, TypedEventTarget } from '../utils/EventEmitter'
import { StateObservable } from '../utils/state-observable'
import { TimeOfDay } from '../utils/time-of-day'
import { DAY_SUN_POSITION, NIGHT_SUN_POSITION } from '../enviroments/world-environment-constants'
import { addCuboid, removeCollider } from '../physics/world'

export type WorldSceneEvents = {
  'fog-updated': void
  'ground-loaded': void
  'parcel-collider-added': BABYLON.AbstractMesh
  'parcel-collider-removed': BABYLON.AbstractMesh
}

export const worldSceneEvents = new TypedEventTarget<WorldSceneEvents>()

let scene: BABYLON.Scene | null = null
let terrain: Terrain | undefined
let skybox: Skybox | undefined
let ambientLight: BABYLON.HemisphericLight | undefined
let groundStateObservable: StateObservable<'loaded' | 'unloaded'> | undefined
let timeOfDay: TimeOfDay = TimeOfDay.Day
let isNightCache: boolean | null = null
let loaded = false

function fogDensity() {
  if (wantsGateway()) return 0
  return Math.max(3 / window.draw.distance - 0.006, 0)
}

function sunPosition() {
  return timeOfDay === TimeOfDay.Night ? NIGHT_SUN_POSITION : DAY_SUN_POSITION
}

function fogColor() {
  return BABYLON.Color3.FromHexString('#030c19')
}

function clearColor() {
  return wantsGateway() ? new BABYLON.Color4(0, 0, 0, 0) : new BABYLON.Color4(0.01, 0.025, 0.05, 1)
}

function updateFog(s: BABYLON.Scene) {
  s.fogMode = BABYLON.Scene.FOGMODE_EXP2
  s.fogDensity = fogDensity()
  s.fogColor = fogColor()
  worldSceneEvents.dispatchEvent(createEvent('fog-updated', undefined))
}

function onEnvironmentStateChanged() {
  if (!scene) return
  updateFog(scene)
  scene.clearColor = clearColor()
}

export function getWorldGroundState(): StateObservable<'loaded' | 'unloaded'> {
  if (!groundStateObservable) throw new Error('createWorldScene() not called')
  return groundStateObservable
}

export function getWorldTimeOfDay() {
  return timeOfDay
}

export function setWorldTimeOfDay(t: TimeOfDay) {
  if (timeOfDay === t) return
  timeOfDay = t
  updateWorldScene()
}

export function getWorldTerrain() {
  return terrain
}

export function worldSceneLoaded() {
  return loaded
}

export async function createWorldScene(s: BABYLON.Scene) {
  if (loaded && scene === s) return
  teardownWorldScene()
  scene = s
  timeOfDay = window.config.isNight ? TimeOfDay.Night : TimeOfDay.Day

  s.clearColor = clearColor()
  updateFog(s)

  ambientLight = new BABYLON.HemisphericLight('sun', sunPosition(), s)
  ambientLight.intensity = 1.0

  window.draw.addEventListener('distance-changed', () => scene && updateFog(scene), { passive: true })
  window.graphic.addEventListener('settingsChanged', () => scene && updateFog(scene), { passive: true })

  skybox = new Skybox(s)
  terrain = new Terrain(s)
  groundStateObservable = terrain.islandsStateObservable
  await terrain.load()

  loaded = true
  worldSceneEvents.dispatchEvent(createEvent('ground-loaded', undefined))
  isNightCache = null
}

export function teardownWorldScene() {
  loaded = false
  skybox?.mesh?.dispose()
  skybox = undefined
  if (terrain) {
    try {
      ;(terrain as any)._ocean?.dispose?.()
    } catch {}
    terrain.groundMeshes.forEach((m) => m.dispose())
  }
  terrain = undefined
  ambientLight?.dispose()
  ambientLight = undefined
  groundStateObservable = undefined
  isNightCache = null
}

export function updateWorldScene() {
  if (!loaded || !scene) return

  const night = timeOfDay === TimeOfDay.Night
  const changed = night !== isNightCache
  isNightCache = night
  if (changed) onEnvironmentStateChanged()
  hideGatewayBackdrop(skybox)
  terrain?.update()
}

export function parcelMeshesAdded(meshes: BABYLON.Mesh[]) {
  meshes.filter(Boolean).forEach((parcelMesh) => {
    if (parcelMesh.name.startsWith('voxel-field/opaque')) {
      worldSceneEvents.dispatchEvent(createEvent('parcel-collider-added', parcelMesh))
    }
  })
}

export function parcelMeshesRemoved(meshes: BABYLON.Mesh[]) {
  meshes.filter(Boolean).forEach((parcelMesh) => {
    if (parcelMesh.name.startsWith('voxel-field/opaque')) {
      worldSceneEvents.dispatchEvent(createEvent('parcel-collider-removed', parcelMesh))
    }
  })
}

// flat grey backdrop for w>0 space slices
let spaceGround: BABYLON.Mesh | undefined

export function createSpaceScene(s: BABYLON.Scene) {
  teardownWorldScene()
  scene = s
  s.clearColor = new BABYLON.Color4(0.45, 0.45, 0.45, 1)
  s.fogMode = BABYLON.Scene.FOGMODE_NONE
  s.fogDensity = 0

  ambientLight = new BABYLON.HemisphericLight('sun', new BABYLON.Vector3(0, 1, 0), s)
  ambientLight.intensity = 1.0

  spaceGround = BABYLON.MeshBuilder.CreatePlane('space/ground', { size: 512 }, s)
  spaceGround.rotate(BABYLON.Axis.X, Math.PI / 2)
  spaceGround.position.y = 0
  const mat = new BABYLON.StandardMaterial('space/ground', s)
  mat.diffuseColor.set(0.5, 0.5, 0.5)
  mat.specularColor.set(0, 0, 0)
  spaceGround.material = mat
  const half = 256
  const hy = 0.5
  addCuboid('space-ground', { x: half, y: hy, z: half }, { x: 0, y: -hy, z: 0 })
}

// Orbit/thumb preview: no sky, fog, or terrain. Caller draws ocean/islands.
export function createPreviewScene(s: BABYLON.Scene) {
  teardownWorldScene()
  scene = s
  s.clearColor = new BABYLON.Color4(0, 0, 0, 1)
  s.fogMode = BABYLON.Scene.FOGMODE_NONE
  s.fogDensity = 0

  ambientLight = new BABYLON.HemisphericLight('sun', new BABYLON.Vector3(0.3, 1, 0.2), s)
  ambientLight.intensity = 0.5
  loaded = true
  groundStateObservable = new StateObservable<'loaded' | 'unloaded'>('loaded')
}

export function teardownSpaceScene() {
  removeCollider('space-ground')
  spaceGround?.dispose()
  spaceGround = undefined
  ambientLight?.dispose()
  ambientLight = undefined
}
