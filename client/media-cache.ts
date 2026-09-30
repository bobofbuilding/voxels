import { parcelMediaUrls } from '../common/media-cache'
const preference = 'voxels.sharePublicMedia'
let registration: Promise<ServiceWorkerRegistration | null> | undefined
export function sharesPublicMedia() {
  try {
    return localStorage.getItem(preference) === 'yes'
  } catch {
    return false
  }
}
export function startMediaCache() {
  if (!registration)
    registration =
      'serviceWorker' in navigator && window.isSecureContext
        ? navigator.serviceWorker
            .register('/world-media-worker.js', { scope: '/', updateViaCache: 'none' })
            .then(async () => {
              const ready = await navigator.serviceWorker.ready
              ready.active?.postMessage({ type: 'sharing', enabled: sharesPublicMedia() })
              return ready
            })
            .catch(() => null)
        : Promise.resolve(null)
  return registration
}
export function setMediaSharing(enabled: boolean) {
  try {
    localStorage.setItem(preference, enabled ? 'yes' : 'no')
  } catch {}
  void startMediaCache().then((r) => r?.active?.postMessage({ type: 'sharing', enabled }))
}
export function registerParcelMedia(parcel: number, content: unknown) {
  if (!Number.isSafeInteger(parcel) || parcel < 1) return
  const urls = parcelMediaUrls(content)
  if (urls.length) void startMediaCache().then((r) => r?.active?.postMessage({ type: 'parcel-media', parcel, urls }))
}
