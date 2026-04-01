import { isSafari } from '../../common/helpers/detector'
import { createEvent, TypedEventTarget } from '../utils/EventEmitter'

const getSaved = (): number | null => {
  if (typeof localStorage === 'undefined') return null
  const stored = localStorage.getItem('mouse_sensitivity')

  if (!stored) return null

  const parsed = parseFloat(stored)

  return isNaN(parsed) ? null : parsed
}

const saveValue = (sensitivity: number) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem('mouse_sensitivity', sensitivity.toString())
}

// higher values are lower sensitivities
export const DEFAULT_SENSITIVITY = isSafari() ? 200 : 500
export const MIN_SENSITIVITY = 200
export const MAX_SENSITIVITY = 2500

export class CameraSettings extends TypedEventTarget<{ 'sensitivity-changed': { value: number } }> {
  private _sensitivity: number = getSaved() ?? DEFAULT_SENSITIVITY

  constructor() {
    super()
  }

  public get angularSensitivity() {
    return this._sensitivity
  }

  public set angularSensitivity(value: number) {
    if (value === this._sensitivity) return
    if (value < MIN_SENSITIVITY) value = MIN_SENSITIVITY
    if (value > MAX_SENSITIVITY) value = MAX_SENSITIVITY

    this._sensitivity = value

    console.debug('CameraSettings: angularSensitivity changed to', value)
    saveValue(value)

    this.dispatchEvent(createEvent('sensitivity-changed', { value }))
  }
}
