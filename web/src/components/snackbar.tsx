import { signal } from '@preact/signals'
import { PanelType } from './panel'

// shown as a second line in the in-world interact-bar
export const snack = signal<{ message: string; onClick?: () => void } | null>(null)
let timer: any

export default {
  show(message: string | Error = '', _type = PanelType.Info, displayTime = 2500, onClick?: () => void) {
    console.log(message)
    snack.value = { message: String(message), onClick }
    clearTimeout(timer)
    timer = setTimeout(() => (snack.value = null), displayTime)
  },
}
