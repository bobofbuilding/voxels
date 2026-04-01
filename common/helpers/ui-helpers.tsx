import { useEffect, useRef } from 'preact/hooks'
import { isMobileMedia } from './detector'

// Attempt to unlock
export const exitPointerLock = () => {
  document.exitPointerLock = document.exitPointerLock || (document as any)['mozExitPointerLock']
  if (document.exitPointerLock) {
    document.exitPointerLock()
  }
}

// allows people to use the space bar to click links and element for for accessibility, e.g. the right hand parcel-tabs
export const extendTabIndexOnClick = () => {
  document.addEventListener(
    'keydown',
    (evt) => {
      if (evt.code == 'Space' && evt.target instanceof HTMLElement && evt.target.tabIndex === 0) {
        evt.target.click()
      }
    },
    { capture: true },
  )
}

export const requestPointerLock = () => {
  const canvas = document.querySelector('canvas#renderCanvas') as HTMLCanvasElement | null
  if (canvas) {
    canvas.focus()
    canvas.requestPointerLock && canvas.requestPointerLock()
  }
}

export const requestPointerLockIfNoOverlays = () => {
  if (!document.querySelector('.pointer-lock-close,.overlay')) {
    if (isMobileMedia()) return // don't request pointer lock on mobile
    requestPointerLock()
  }
}

export const hasPointerLock = () => {
  return !!(document.pointerLockElement || (document as any)['mozPointerLockElement'])
}

// will autofocus any element with this applied to `ref` attribute
export function autoFocusRef(autoFocus = true) {
  if (autoFocus) {
    const ref = useRef(null) as any

    useEffect(() => {
      ref?.current?.focus?.({ preventScroll: true })
    }, [ref])

    return ref
  }
}
