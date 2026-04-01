import type { RegionEvent } from '../regional-effects-manager'
import type { Scene } from '../scene'
import { easeInSineDistance } from '../utils/easing'
import LutFactor from './lut-factor'

export class ColorGrader {
  lutActive: BABYLON.ColorGradingTexture | BABYLON.Texture | null = null
  loadingLut: string | null = null
  disposed = false
  private loadingLutPromise: Promise<BABYLON.ColorGradingTexture | BABYLON.Texture> | null = null
  private readonly _postProcess: BABYLON.ImageProcessingPostProcess
  private loadingController: null | AbortController = null
  private readonly lutLoopCallback: () => void

  constructor(
    private scene: Scene,
    private lutFactor: LutFactor,
  ) {
    // warning setting reusable to true causes youtube and twitch videos to wobble... not sure why
    this._postProcess = new BABYLON.ImageProcessingPostProcess('luts', 1.0, null, BABYLON.Texture.BILINEAR_SAMPLINGMODE, this.scene.getEngine(), false, BABYLON.Constants.TEXTURETYPE_HALF_FLOAT)
    this._postProcess.colorGradingEnabled = true
    this._postProcess.colorCurvesEnabled = false
    this._postProcess.toneMappingEnabled = false
    this._postProcess.vignetteEnabled = false
    // Enable dithering to break up gradient banding (same as skybox material)
    // Adds subtle noise to overcome precision issues in shader pipeline
    this._postProcess.imageProcessingConfiguration.ditheringEnabled = true
    this._postProcess.imageProcessingConfiguration.ditheringIntensity = 1.0 / 255.0
    // Explicitly set applyByPostProcess to ensure materials skip their own image processing
    this._postProcess.imageProcessingConfiguration.applyByPostProcess = true
    this._postProcess.samples = 1

    // use render loop to apply the current LUT level without excessive updates
    this.lutLoopCallback = () => {
      if (!this.lutActive) return
      if (this.lutActive.level === this.lutLevel) return
      // todo could ease this?
      // apply LUT level
      this.lutActive.level = this.lutLevel
    }
    scene.onBeforeRenderObservable.add(this.lutLoopCallback)
  }

  private _lutLevel = 1

  public get lutLevel() {
    return this._lutLevel * this.lutFactor.factor
  }

  public get postProcess(): BABYLON.ImageProcessingPostProcess {
    return this._postProcess
  }

  // if post-processing pipeline changes we need to re-apply the lut-line
  reload() {
    this._postProcess.colorGradingEnabled = false
    this._postProcess.colorGradingTexture = null
    // Ensure applyByPostProcess stays true so materials don't do their own processing
    this._postProcess.imageProcessingConfiguration.applyByPostProcess = true
    if (this.lutActive) {
      this.setLut(this.lutActive, this.lutActive.level)
    }
  }

  dispose() {
    this._postProcess.dispose()
    this.lutActive?.dispose()
    this.scene.onBeforeRenderObservable.removeCallback(this.lutLoopCallback)
    this.disposed = true
  }

  colorGradingEntered(ev: { detail: RegionEvent }) {
    const easedStrength = easeInSineDistance(ev.detail.strength)
    if (this.lutActive?.url === ev.detail.value || this.loadingLut === ev.detail.value) {
      // update effect strength
      this.setLutLevel(easedStrength)
      return
    }
    // abort any previous lut loads
    if (this.loadingController) {
      this.loadingController.abort('ABORT:loading new LUT')
    }
    this.loadingController = new AbortController()
    this.loadLutFromUrl(ev.detail.value, this.loadingController.signal, easedStrength).then(() => {
      this.loadingController = null
    })
  }

  colorGradingExited(ev: { detail: RegionEvent }) {
    if (this.loadingLut === ev.detail.value && this.loadingController) {
      this.loadingController.abort('ABORT: exiting region')
      this.loadingController = null
      return
    }
    if (this.lutActive?.url === ev.detail.value) {
      this.clearLut()
    }
  }

  private setLut(lut: BABYLON.ColorGradingTexture | BABYLON.Texture, level = 1) {
    this._postProcess.colorGradingEnabled = true
    this._postProcess.colorGradingTexture = lut
    this._postProcess.samples = 0

    lut.level = level
    this.lutActive = lut
  }

  private setLutLevel(level: number) {
    if (!this.lutActive && !this.loadingLut) {
      throw new Error('no lut active')
    }

    if (level > 1 || level < 0) {
      throw new Error('level must be between 0 and 1')
    }

    if (this._lutLevel === level || this.lutActive?.level === level) return

    this._lutLevel = level
  }

  private async load3DLut(url: string, signal: AbortSignal) {
    return new Promise<BABYLON.ColorGradingTexture>((resolve, reject) => {
      if (signal.aborted) return reject(new Error('aborted'))

      const onAbort = () => {
        colorGrading.dispose()
        reject(new Error('aborted'))
      }

      signal.addEventListener('abort', onAbort, { once: true })
      // todo fetch with signal, asset manager?
      // error handling? timeout?
      const colorGrading: BABYLON.ColorGradingTexture = new BABYLON.ColorGradingTexture(url, this.scene, () => {
        if (signal.aborted) return reject(new Error('aborted'))
        signal.removeEventListener('abort', onAbort)
        return resolve(colorGrading)
      })
    })
  }

  private async loadPNGLut(url: string, signal: AbortSignal) {
    return new Promise<BABYLON.Texture>((resolve, reject) => {
      if (signal.aborted) return reject(new Error('aborted'))
      const colorGrading = new BABYLON.Texture(url, this.scene, true, false)
      colorGrading.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE
      colorGrading.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE

      // need this setting for .png luts to work
      this._postProcess.imageProcessingConfiguration.colorGradingWithGreenDepth = false

      const onAbort = () => {
        colorGrading.dispose()
        reject(new Error('aborted'))
      }

      signal.addEventListener('abort', onAbort, { once: true })

      colorGrading.onLoadObservable.addOnce(() => {
        if (signal.aborted) return reject(new Error('aborted'))
        signal.removeEventListener('abort', onAbort)
        if (colorGrading.loadingError) return reject(new Error(colorGrading.errorObject?.message ?? 'loading error'))
        return resolve(colorGrading)
      })
    })
  }

  private async loadLutFromUrl(url: string, signal: AbortSignal, strength = 1) {
    if (signal.aborted) throw new Error('aborted')
    if (!url) throw new Error('no url')

    if (this.loadingLut === url && this.loadingLutPromise) return this.loadingLutPromise

    if (this.loadingLutPromise) {
      throw new Error('already loading a lut')
    }
    this._lutLevel = strength
    try {
      this.loadingLut = url
      this.loadingLutPromise = url.endsWith('.png') ? this.loadPNGLut(url, signal) : this.load3DLut(url, signal)

      const lut = await this.loadingLutPromise

      if (signal.aborted) throw new Error('aborted')

      this.setLut(lut, strength)
    } finally {
      this.loadingLut = null
      this.loadingLutPromise = null
    }
  }

  private clearLut() {
    this._postProcess.colorGradingEnabled = false
    this._postProcess.colorGradingTexture = null
    this._postProcess.samples = 0
    this.lutActive?.dispose()
    this.lutActive = null
    this._lutLevel = 1
  }
}
