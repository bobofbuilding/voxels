import { expect, test } from 'vitest'
import { cameraConstraints, cameraError, mobileConstraints, wirePreview } from '../client/broadcast/media'

test('in-world portrait and web landscape camera policies stay explicit', () => {
  expect(mobileConstraints('user', 'portrait')).toEqual({ facingMode: 'user', aspectRatio: { ideal: 9 / 16 } })
  expect(mobileConstraints('environment', 'portrait')).toEqual({ facingMode: 'environment' })
  expect(mobileConstraints('environment', 'landscape')).toEqual({ facingMode: 'environment', aspectRatio: { ideal: 16 / 9 } })
  expect(cameraConstraints('camera-2', false, 'portrait')).toEqual({ deviceId: { exact: 'camera-2' } })
})

test('camera errors offer screensharing only where supported', () => {
  expect(cameraError({ name: 'NotFoundError' }, true)).toContain('screenshare')
  expect(cameraError({ name: 'NotFoundError' })).not.toContain('screenshare')
})

test('video metadata updates the preview without a render polling loop', () => {
  const wrap = document.createElement('div')
  const video = document.createElement('video')
  wirePreview(wrap, video, 'contain')
  Object.defineProperty(video, 'videoWidth', { value: 720 })
  Object.defineProperty(video, 'videoHeight', { value: 1280 })
  video.dispatchEvent(new Event('loadedmetadata'))
  expect(wrap.style.aspectRatio).toBe('720 / 1280')
  expect(video.style.objectFit).toBe('contain')
})
