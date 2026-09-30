import type { VideoCaptureOptions } from 'livekit-client'

export type CameraShape = 'portrait' | 'landscape'

export function mobileConstraints(facing: 'user' | 'environment' = 'user', shape: CameraShape = 'portrait') {
  const constraints: VideoCaptureOptions & Pick<MediaTrackConstraints, 'aspectRatio'> = { facingMode: facing }
  if (shape === 'landscape') constraints.aspectRatio = { ideal: 16 / 9 }
  else if (facing === 'user') constraints.aspectRatio = { ideal: 9 / 16 }
  return constraints
}

export function cameraConstraints(deviceId: string | undefined, mobile: boolean, shape: CameraShape) {
  if (mobile) return mobileConstraints('user', shape)
  return deviceId ? { deviceId: { exact: deviceId } } : {}
}

export function cameraError(e: unknown, screenshare = false): string {
  const name = (e as { name?: string } | null)?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'camera blocked - allow camera access in your browser, then go live again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return screenshare ? 'no camera found - plug one in or tick "use screenshare instead". for audio only, drop a Boombox.' : 'no camera found - plug one in and try again.'
  if (name === 'NotReadableError' || name === 'AbortError') return 'your camera is busy in another app - close it and try again.'
  return 'could not start your camera - check browser permissions, then go live again.'
}

export function wirePreview(wrap: HTMLElement, el: HTMLVideoElement, fit: 'contain' | 'cover', aspectRatio?: string) {
  Object.assign(el.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', objectFit: fit, display: 'block' })
  const sync = () => {
    el.removeAttribute('width')
    el.removeAttribute('height')
    if (aspectRatio) wrap.style.aspectRatio = aspectRatio
    else if (el.videoWidth > 0 && el.videoHeight > 0) wrap.style.aspectRatio = `${el.videoWidth} / ${el.videoHeight}`
    el.style.objectFit = fit
  }
  // Metadata and resize events cover initial attachment and camera/track changes.
  el.addEventListener('loadedmetadata', sync)
  el.addEventListener('loadeddata', sync)
  el.addEventListener('resize', sync)
  sync()
  return sync
}

export function cohostIdentityPrefix(identity: string) {
  const i = identity.lastIndexOf('-')
  return i > 0 ? identity.slice(0, i) : identity
}

export function cohostVideoReady(el: HTMLVideoElement | null) {
  return !!(el && el.readyState >= 1 && el.videoWidth > 0)
}

export function cohostVideoTrackLive(el: HTMLVideoElement | null) {
  const mst = (el?.srcObject as MediaStream | null)?.getVideoTracks?.()?.[0]
  return !!mst && mst.readyState !== 'ended'
}
