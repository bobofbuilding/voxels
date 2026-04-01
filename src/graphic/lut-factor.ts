import { createEvent, TypedEventTarget } from '../utils/EventEmitter'

const DEFAULT_LUT_FACTOR = 1

// holds the current MAX lut factor allowing users to dial it down (or up) if they want to
// this could be adjusted via a slider in the UI for example
export default class LutFactor extends TypedEventTarget<{ changed: { value: number } }> {
  private lutFactor = isNaN(DEFAULT_LUT_FACTOR) ? 1 : DEFAULT_LUT_FACTOR

  constructor() {
    super()
  }

  public get factor() {
    return this.lutFactor
  }

  public set factor(value: number) {
    if (value === this.lutFactor) return
    this.lutFactor = value
    this.dispatchEvent(createEvent('changed', { value }))
  }
}
