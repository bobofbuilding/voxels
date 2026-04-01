import { Environment } from './enviroments/environment'
import { GraphicEngine } from './graphic/graphic-engine'
import { DrawDistance } from './graphic/draw-distance'
import type { Options, VoxImporter } from '../common/vox-import/vox-import'
import { StateObservable } from './utils/state-observable'
import OurCamera from './controls/utils/our-camera'
import { wantsAudio } from '../common/helpers/detector'
import { FOV } from './graphic/field-of-view'
import { CameraSettings } from './controls/user-control-settings'

export type SceneConfig = BABYLON.DeepImmutableObject<
  (
    | {
        // legacy naming, the main world is called 'the grid'
        isGrid: true // if we are on grid then we are not in space
        isSpace: false
        spaceId: null
      }
    | {
        isGrid: false // if we are not on grid then well we are clearly in a space
        isSpace: true
        spaceId: string
      }
  ) & {
    isOrbit: boolean
    isBot: boolean
    coords?: string
    isNight: boolean
    wantsAudio?: boolean
    wantsURL: boolean
    isMultiuser: boolean
    wantsUI: boolean
  }
>

export const isSpace = (scene: Scene): scene is Scene & { config: SceneConfig & { isSpace: true; isGrid: false; spaceId: string } } => {
  return scene.config.isSpace
}

export const isWorld = (scene: Scene): scene is Scene & { config: SceneConfig & { isSpace: false; isGrid: true; spaceId: null } } => {
  return scene.config.isGrid
}

/**
 * Custom Scene class that extends BabylonJS Scene with additional functionality.
 */
export class Scene extends BABYLON.Scene {
  public environmentState = new StateObservable<'set' | 'unset'>('unset')
  private readonly _graphic: GraphicEngine
  private readonly _draw: DrawDistance
  private readonly _voxImport: VoxImporter

  constructor(
    engine: BABYLON.Engine,
    graphic: GraphicEngine,
    draw: DrawDistance,
    voxImporter: VoxImporter,
    public readonly config: SceneConfig,
    public readonly fov: FOV,
    public readonly cameraSettings: CameraSettings,
    options?: BABYLON.SceneOptions,
  ) {
    super(engine, options)
    this._graphic = graphic
    this._draw = draw
    this._voxImport = voxImporter
  }

  private _environment?: Environment

  get environment(): Environment | undefined {
    if (!this._environment) {
      console.warn('no environment set!')
    }
    return this._environment
  }

  set environment(v: Environment | undefined) {
    this._environment = v

    // vox import needs an environment before being able to kick in
    this._voxImport.initialize(this)
    this.environmentState.setState(v ? 'set' : 'unset')
  }

  get draw(): DrawDistance {
    return this._draw
  }

  get graphic(): GraphicEngine {
    return this._graphic
  }

  get cameraPosition(): BABYLON.Vector3 {
    if (!this.activeCamera) {
      console.warn('No camera found ')
      return BABYLON.Vector3.Zero()
    }
    if (this.activeCamera instanceof BABYLON.ArcRotateCamera) {
      // orbit mode, return orbit target
      return this.activeCamera.target
    }

    // webxr camera uses different position system, this is a quick hack to get the position
    if (this.activeCamera instanceof BABYLON.WebXRCamera) {
      const offSet = this._environment ? this._environment.parent.position : BABYLON.Vector3.Zero()
      return this.activeCamera.position.subtract(offSet)
    }

    // return camera position
    return this.activeCamera.position
  }

  set cameraPosition(position: BABYLON.Vector3) {
    if (!this.activeCamera) {
      console.warn('No camera found ')
      return
    }
    if (this.activeCamera instanceof BABYLON.ArcRotateCamera) {
      // orbit mode, set orbit target
      this.activeCamera.target = position
      return
    }

    // webxr camera uses different position system, this is a quick hack to set the position
    if (this.activeCamera instanceof BABYLON.WebXRCamera) {
      const offSet = this._environment ? this._environment.parent.position : BABYLON.Vector3.Zero()
      this.activeCamera.position = position.add(offSet)
      return
    }

    // set camera position
    this.activeCamera.position = position
  }

  get cameraRotation(): BABYLON.Vector3 {
    if (!this.activeCamera) {
      console.warn('No camera found ')
      return BABYLON.Vector3.Zero()
    }
    if (this.activeCamera instanceof BABYLON.ArcRotateCamera) {
      // orbit mode, return orbit target
      return this.activeCamera.rotation
    }

    if (this.activeCamera instanceof OurCamera) {
      return this.activeCamera.rotation
    }

    if (this.activeCamera instanceof BABYLON.WebXRCamera) {
      return this.activeCamera.rotationQuaternion.toEulerAngles()
    }

    console.warn('No camera rotation found')

    return BABYLON.Vector3.Zero()
  }

  set cameraRotation(rotation: BABYLON.Vector3) {
    if (!this.activeCamera) {
      console.warn('No camera found ')
      return
    }
    if (this.activeCamera instanceof BABYLON.ArcRotateCamera) {
      // orbit mode, set rotation
      this.activeCamera.rotation = rotation
      return
    }

    if (this.activeCamera instanceof OurCamera) {
      this.activeCamera.rotation = rotation
      return
    }

    if (this.activeCamera instanceof BABYLON.WebXRCamera) {
      this.activeCamera.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(rotation.x, rotation.y, rotation.z)
      return
    }
    console.warn('No camera rotation setter found')
  }

  importVox(urlOrBuffer: string | ArrayBuffer, options: Options) {
    return this._voxImport.import(urlOrBuffer, options)
  }

  readonly disableShaders: boolean = false
}

const defaultConfig: SceneConfig = {
  isGrid: true,
  isSpace: false,
  spaceId: null,
  isBot: false,
  isNight: false,
  wantsAudio: true,
  wantsURL: true,
  isOrbit: false,
  isMultiuser: false,
  wantsUI: false,
}

export const sceneConfigFromURL = (): SceneConfig => {
  const location = document.location.toString()
  const pathName = document.location.pathname
  const searchParams = new URLSearchParams(document.location.search.substring(1))

  // isSpace detector for when inside the space, (not the space home page)
  const isSpace = (): boolean => {
    return !!location?.match(/(assets|spaces).+play/)
  }
  const isOrbit = (): boolean => searchParams.get('mode') === 'orbit'
  const isBot = (): boolean => !!document.location.pathname.match(/capture/) || searchParams.get('bot') === 'true'
  const isNight = (): boolean => searchParams.get('time') === 'night'
  const wantsURL = (): boolean => !isSpace() && !isOrbit() && !isBot()

  function getSpaceId(): string | null {
    const match = pathName.match(/(assets|spaces)\/(.+)\/play$/)
    return match ? match[2] : null
  }

  const isMultiuser = (): boolean => {
    return !isOrbit() && searchParams.get('mp') !== 'off'
  }

  const wantsUI = (): boolean => {
    return !isOrbit() && !['off', 'false', '0'].includes(searchParams.get('ui') ?? 'on')
  }

  return Object.assign({}, defaultConfig, {
    isGrid: !isSpace(),
    isSpace: isSpace(),
    spaceId: getSpaceId(),
    isBot: isBot(),
    isNight: isNight(),
    wantsAudio: wantsAudio(),
    wantsURL: wantsURL(),
    isOrbit: isOrbit(),
    isMultiuser: isMultiuser(),
    wantsUI: wantsUI(),
  })
}
