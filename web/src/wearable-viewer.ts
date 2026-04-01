import { isSafari } from '../../common/helpers/detector'
import { createWearableScene } from './helpers/scenes'
import { VoxImporter } from '../../common/vox-import/vox-import'
import { loadWearableVox } from './helpers/wearable-helpers'

export class WearableViewer {
  private readonly canvas: HTMLCanvasElement
  private worker?: Worker
  private scene?: BABYLON.Scene
  private offscreenCanvas?: OffscreenCanvas

  private activeMesh?: BABYLON.Mesh
  private importer?: VoxImporter

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  public loadHash(hash: string) {
    this.loadURL(`${process.env.ASSET_PATH}/w/${hash}/vox`)
  }

  public loadURL(urlOrBuffer: string | ArrayBuffer) {
    if (!isSafari() && 'OffscreenCanvas' in window && 'transferControlToOffscreen' in this.canvas) {
      this.toOffscreen(urlOrBuffer)
    } else {
      this.toOnscreen(urlOrBuffer)
    }
  }

  resizeHandler = () => this.scene?.getEngine().resize()

  dispose() {
    this.worker?.postMessage({ dispose: true }, [])
    window.removeEventListener('resize', this.resizeHandler.bind(this))
    this.scene?.dispose()
    this.scene?.getEngine().dispose()
  }

  private toOffscreen(urlOrBuffer: string | ArrayBuffer) {
    if (!this.offscreenCanvas) {
      this.canvas.width = this.canvas.clientWidth
      this.canvas.height = this.canvas.clientHeight
      this.offscreenCanvas = this.canvas.transferControlToOffscreen()
      // Triple slash comment with #if is for the ifdef-loader plugin: https://www.npmjs.com/package/ifdef-loader
      /// #if RUNTIME === 'WEB'
      this.worker = new Worker(new URL('./workers/wearable', import.meta.url))
      /// #endif
      this.worker?.postMessage({ canvas: this.offscreenCanvas }, [this.offscreenCanvas])
    }
    this.worker?.postMessage({ url: urlOrBuffer })
  }

  private toOnscreen(urlOrBuffer: string | ArrayBuffer) {
    const { scene } = createWearableScene(this.canvas)
    this.scene = scene
    window.addEventListener('resize', this.resizeHandler.bind(this), { passive: true })
    this.scene?.getEngine().runRenderLoop(() => this.scene?.render())
    if (!this.importer) {
      this.importer = new VoxImporter()
      this.importer.initialize(this.scene)
    }
    this.activeMesh?.dispose(false, true)
    loadWearableVox(this.importer, urlOrBuffer, this.scene, new AbortController()).then((mesh) => {
      this.activeMesh = mesh
    })
  }
}
