import { isDesktop, isMobile, isTablet, wantsXR } from '../../common/helpers/detector'
import DesktopControls from './desktop/controls'
import MobileControls from './mobile/controls'
import OrbitControls from './orbit/controls'
import type Controls from './controls'
import OrbitSpaceControls from './orbit/space-controls'
import type { Scene } from '../scene'
import XROverlay from './webxr'

export let xr: XROverlay | undefined

export const CreateControls = (scene: Scene, canvas: HTMLCanvasElement): Controls => {
  let controls: Controls | undefined

  if (scene.config.isOrbit) {
    if (scene.config.isSpace) {
      controls = new OrbitSpaceControls(scene, canvas)
    } else {
      controls = new OrbitControls(scene, canvas)
    }
  } else if (isMobile() || isTablet()) {
    controls = new MobileControls(scene, canvas)
  } else if (isDesktop()) {
    controls = new DesktopControls(scene, canvas)
  }

  if (wantsXR()) {
    xr = new XROverlay(scene, canvas, controls!)
    let started = false

    navigator.xr?.addEventListener('sessiongranted', () => {
      console.log('onSessionGranted')
      started = true

      xr?.start()
    })

    canvas.addEventListener('click', (e: any) => {
      if (!started && xr) {
        started = true

        e.preventDefault()
        xr.start()
      }
    })
  }

  return controls!
}
