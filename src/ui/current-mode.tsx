import type { Signal } from '@preact/signals'
import type { FeatureSelectionMode } from '../tools/feature'

export const CurrentModeOverlay = ({ nextMode, mode, enabled }: { nextMode?: FeatureSelectionMode | null; mode?: FeatureSelectionMode; enabled: Signal<boolean> }) => {
  if (!enabled.value) return null
  if (!mode) return null

  const _mode = nextMode ? nextMode : mode

  const labelMode = _mode.charAt(0).toUpperCase() + _mode.slice(1)

  return (
    <div class={'feature-mode-overlay'}>
      <div>{labelMode} mode enabled</div>
    </div>
  )
}
