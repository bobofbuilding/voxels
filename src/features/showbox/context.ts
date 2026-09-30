import Cookies from 'js-cookie'
import { decodeJwt } from 'jose'
import { isMobile } from '../../../client/platform'
import { showboxTokenUrlWithIdentity } from '../../../client/broadcast/session'
import ParcelHelper, { showboxAudiencePlayCoordsFromRecord, showboxFanSharePlayQuery, showboxHostPlayCoordsFromRecord, showboxHostPlayQuery } from '../../../common/helpers/parcel-helper'
import { app } from '../../../web/src/state'
import { Animations } from '../../avatar-animations'
import type Showbox from './scene'

export const DOCK_DANCES: Array<{ label: string; anim: Animations }> = [
  { label: 'dance', anim: Animations.Dance },
  { label: 'hype', anim: Animations.Hype },
  { label: 'clap', anim: Animations.Applause },
  { label: 'spin', anim: Animations.Spin },
  { label: 'savage', anim: Animations.Savage },
]

export const DOCK_EMOJIS = ['🔥', '🙌', '❤️', '😂', '👏', '🎉']

export const DEFAULT_VOLUME = 0.7

export const MAX_VOLUME = 1

export const VOLUME_REFRESH_INTERVAL = 200

export const VIEWER_RETRY_INTERVAL = 20_000

export const STREAM_ATTACH_RETRY_MS = 2000

export const STREAM_ATTACH_RECONNECT_AFTER = 5

export const VIEWER_MILESTONES = [10, 25, 50] as const

export const COHOST_CONNECT_GRACE_MS = 8000

export function viewerCountLabel(n: number) {
  return n === 1 ? '1 viewer' : `${n} viewers`
}

export function celebrateLabel(n: number) {
  if (n >= 50) return '50 here'
  if (n >= 25) return '25 here'
  return `${n} here`
}

export function uuidBucket(uuid: string, mod: number) {
  let h = 0
  for (let i = 0; i < uuid.length; i++) h = (h + uuid.charCodeAt(i)) | 0
  return Math.abs(h) % mod
}

export function celebrateBursts(n: number) {
  if (n >= 50) return { emojis: ['🎉', '🔥', '🙌', '❤️', '👏', '🎉', '🔥'], staggerMs: 280 }
  if (n >= 25) return { emojis: ['🎉', '🔥', '🙌', '❤️', '🎉'], staggerMs: 380 }
  if (n >= 10) return { emojis: ['🎉', '🔥', '🙌'], staggerMs: 300 }
  return { emojis: ['🎉'], staggerMs: 0 }
}

export function celebrateMoves(n: number, uuid: string) {
  const b = uuidBucket(uuid, 12)
  const wild = [Animations.Hype, Animations.Spin, Animations.Savage, Animations.Celebration]
  if (n >= 50) {
    return { anims: [wild[b % 4], wild[(b + 5) % 4], Animations.Spin], gapMs: 1100 }
  }
  if (n >= 25) {
    const pool = [Animations.Dance, Animations.Hype, Animations.Spin, Animations.Savage]
    return { anims: [pool[b % 4], pool[(b + 3) % 4]], gapMs: 900 }
  }
  if (n >= 10) return { anims: [Animations.Dance], gapMs: 0 }
  return { anims: [] as Animations[], gapMs: 0 }
}

export const mobile = isMobile()

export const LANDSCAPE_MESH_W = 640

export const LANDSCAPE_MESH_H = 360

export const PORTRAIT_MESH_W = 360

export const PORTRAIT_MESH_H = 640

export const THUMB_W = 256

export const THUMB_H = 144

export const LANDSCAPE_SCALE: [number, number, number] = [2, 1, 0]

export const PORTRAIT_SCALE: [number, number, number] = [1, 16 / 9, 0]

export function isRoomFullError(e: unknown) {
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return msg.includes('room is full') || (msg.includes('participant') && (msg.includes('limit') || msg.includes('max') || msg.includes('full')))
}

export function syncVideoElFromTrack(el: HTMLVideoElement | null, track: { mediaStreamTrack?: MediaStreamTrack } | null | undefined) {
  const mst = track?.mediaStreamTrack
  if (!el || !mst || mst.readyState === 'ended') return
  const cur = el.srcObject instanceof MediaStream ? el.srcObject.getVideoTracks()[0] : null
  if (cur === mst) return
  el.srcObject = new MediaStream([mst])
  el.play().catch(() => {})
}

export function makeDockPreviewVideo(track: { mediaStreamTrack?: MediaStreamTrack } | null | undefined) {
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.autoplay = true
  v.setAttribute('playsinline', '')
  v.setAttribute('webkit-playsinline', 'true')
  syncVideoElFromTrack(v, track)
  return v
}

export function guestJwtPayload(): { wallet?: string; guest_pass?: string; feature_uuid?: string; parcel_id?: number } | null {
  try {
    const key = app.state.key || Cookies.get('jwt')
    if (!key) return null
    return decodeJwt(key) as { wallet?: string; guest_pass?: string; feature_uuid?: string }
  } catch {
    return null
  }
}

export function showboxJoinShowUuid(): string | null {
  try {
    const show = new URL(window.location.href).searchParams.get('show')
    return show ? show.toLowerCase() : null
  } catch {
    return null
  }
}

export function isSyntheticGuestWallet() {
  const w = (guestJwtPayload()?.wallet ?? app.state.wallet)?.toLowerCase()
  return !!w?.startsWith('guest:')
}

export function guestPassToken(): string | null {
  const fromJwt = guestJwtPayload()?.guest_pass
  if (fromJwt) return fromJwt
  try {
    const u = new URL(window.location.href)
    const fromUrl = u.searchParams.get('guest_pass')
    if (fromUrl) {
      sessionStorage.setItem('showbox_guest_pass', fromUrl)
      return fromUrl
    }
  } catch {}
  try {
    return sessionStorage.getItem('showbox_guest_pass')
  } catch {
    return null
  }
}

export function isGuestForShowbox(uuid: string): boolean {
  const showMatch = showboxJoinShowUuid() === uuid.toLowerCase()
  if (isSyntheticGuestWallet()) {
    const payload = guestJwtPayload()
    if (payload?.feature_uuid === uuid) return true
    return showMatch
  }
  if (app.signedIn && guestPassToken() && showMatch) return true
  return false
}

export function isGuestOnParcel(parcelId: number | string): boolean {
  if (!guestPassToken()) return false
  const payload = guestJwtPayload()
  if (payload?.parcel_id != null) return Number(payload.parcel_id) === Number(parcelId)
  return !!showboxJoinShowUuid()
}

export function showboxRoomTokenUrl(roomName: string, reusePublisher = false) {
  let base = `/api/rooms/${roomName}/token`
  const pass = guestPassToken()
  if (pass && !guestJwtPayload()?.guest_pass) {
    base = `${base}?guest_pass=${encodeURIComponent(pass)}`
  }
  return showboxTokenUrlWithIdentity(base, roomName, reusePublisher)
}

export function showboxFeatureCoords(feature: Showbox) {
  const parcel = new ParcelHelper(feature.parcel as any)
  const f = { position: feature.tidyPosition, rotation: feature.tidyRotation, guestMode: feature.guestMode }
  return { parcel, f }
}

export function audienceShowUrl(feature: Showbox): string {
  const { parcel, f } = showboxFeatureCoords(feature)
  const coords = showboxAudiencePlayCoordsFromRecord(parcel, f)
  return `${window.location.origin}/play?${showboxFanSharePlayQuery(coords, feature.uuid)}`
}

export function hostJoinShowUrl(feature: Showbox): string {
  const { parcel, f } = showboxFeatureCoords(feature)
  const coords = showboxHostPlayCoordsFromRecord(parcel, f)
  return `${window.location.origin}/play?${showboxHostPlayQuery(coords, feature.uuid, mobile)}`
}

export function isHostJoinForShowbox(uuid: string): boolean {
  if (isGuestForShowbox(uuid)) return false
  try {
    const q = new URL(window.location.href).searchParams
    const show = q.get('show')
    return q.get('host') === '1' && !!show && show.toLowerCase() === uuid.toLowerCase()
  } catch {
    return false
  }
}

export function wantsHostJoin(uuid: string): boolean {
  return isHostJoinForShowbox(uuid)
}

export function clearShowboxJoinParams() {
  try {
    const u = new URL(window.location.href)
    if (!u.searchParams.has('show') && !u.searchParams.has('host')) return
    u.searchParams.delete('show')
    u.searchParams.delete('host')
    u.searchParams.delete('guest_pass')
    const qs = u.searchParams.toString()
    window.history.replaceState(window.history.state, '', u.pathname + (qs ? `?${qs}` : '') + u.hash)
  } catch {}
}

export function syncGuestDisplayName(name: string) {
  app.setName(name)
  if (app.avatarRef && typeof app.avatarRef === 'object') {
    app.avatarRef = { ...app.avatarRef, name }
  }
  const av = window.persona?.avatar as { _description?: { name?: string } } | undefined
  if (av?._description) av._description.name = name
  try {
    const boxes = (window as any).persona?.parcel?.getFeaturesByType?.('showbox') ?? []
    if (boxes.some((f: any) => f?.broadcastRoom)) return
  } catch {}
  window.connector?.reconnect()
}

export type GuestMode = 'solo' | 'cohost'

export type MirrorSource = 'auto' | 'host' | 'collaborator' | 'guest'

export type MirrorRole = 'host' | 'collaborator' | 'guest'

export const DEFAULT_GUEST_MODE: GuestMode = 'cohost'

export type ShowboxIntermission = { label: string; until: number | null; at: number }

export type ShowboxCelebrateState = { celebrate?: number; at?: number; intermission?: ShowboxIntermission | null }
