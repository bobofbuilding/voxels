import { isTablet } from '../../../common/helpers/detector'
import Connector from '../../connector'
import type { Scene } from '../../scene'
import { MinimapSettings } from '../../minimap'

export default function MobileButtons({ connector, scene, minimapSettings }: { connector: Connector; scene: Scene; minimapSettings: MinimapSettings }) {
  return (
    <div class="mobile-buttons">
      <div style={(isTablet() && scene.config.isGrid && { bottom: '200px' }) as any} className="mobile-controls-container">
        <button className="camera-view-button hex-button" onClick={() => connector.controls.togglePerspective()}>
          Zoom
        </button>
        <button className="fly-button hex-button" onClick={() => connector.controls.toggleFlying()}>
          Fly
        </button>
      </div>
    </div>
  )
}
