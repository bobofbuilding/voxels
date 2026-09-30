import type { ShowboxCelebrateState } from './context'
import { drawVideoCover } from '../../../client/media/draw-video-cover'
import { cameraConstraints, mobileConstraints, cohostIdentityPrefix, cohostVideoReady, cohostVideoTrackLive } from '../../../client/broadcast/media'
import { h } from 'preact'
import { wantsAudio } from '../../../client/platform'
import { refreshMobileCanvasAfterReturn } from '../../controls/mobile/controls'
import {
  BROADCAST_CAMERA_ENDED_DELAY_MS,
  BROADCAST_CAMERA_STRIKES,
  BROADCAST_DISCONNECT_STRIKES,
  BROADCAST_HEALTH_POLL_MS,
  BROADCAST_LIVE_GRACE_MS,
  BROADCAST_RECONNECT_MAX,
  broadcastVideoTrackLive,
  fetchShowboxRoomToken,
  LIVEKIT_URL,
  livekitRoomState,
  publishedVideoTrack,
  saveShowboxPublisherIdentity,
} from '../../../client/broadcast/session'
import { VideoFxProcessor, type FxAudio } from '../../../client/broadcast/video-fx'
import { showboxAudiencePlayCoordsFromRecord } from '../../../common/helpers/parcel-helper'
import { exitPointerLock } from '../../../client/ui/helpers'
import { duckRadio, setRadioBroadcasting, unduckRadio } from '../../../web/src/radio/global'
import { broadcastDockEl, broadcastLiveStartedAt, broadcastShowboxUuid, closeBroadcastSidebar, sidebarClosed, uiAsideTick } from '../../store'
import { consumeGuestFreshFromUrl, maybeRefreshGuestJwt } from '../../../client/broadcast/guest-pass'
import { cohostPaneRects, MAX_COHOST_PANES } from '../../../common/helpers/cohost-panes'
import { encodeCoords } from '../../../common/helpers/utils'
import { ShowboxRecord } from '../../../common/messages/feature'
import { Room, RoomEvent, Track, createLocalScreenTracks, createLocalTracks, createLocalVideoTrack } from 'livekit-client'
import { app, AppEvent } from '../../../web/src/state'
import { PanelType } from '../../../web/src/components/panel'
import { Animations } from '../../avatar-animations'
import { cameraPosition, cameraRotation } from '../../utils/camera'
import { emote as emoteParticles } from '../../utils/emote'
import { AudioBus } from '../../audio/audio-engine'
import { SpatialAudio } from '../../audio/spatial-audio'
import { FeatureMetadata, FeatureTemplate } from '../_metadata'
import { Feature2D } from '../feature'
import {
  DEFAULT_VOLUME,
  MAX_VOLUME,
  VOLUME_REFRESH_INTERVAL,
  VIEWER_RETRY_INTERVAL,
  STREAM_ATTACH_RETRY_MS,
  STREAM_ATTACH_RECONNECT_AFTER,
  VIEWER_MILESTONES,
  COHOST_CONNECT_GRACE_MS,
  celebrateLabel,
  celebrateBursts,
  celebrateMoves,
  mobile,
  LANDSCAPE_MESH_W,
  LANDSCAPE_MESH_H,
  PORTRAIT_MESH_W,
  PORTRAIT_MESH_H,
  THUMB_W,
  THUMB_H,
  syncVideoElFromTrack,
  guestJwtPayload,
  isSyntheticGuestWallet,
  isGuestForShowbox,
  isGuestOnParcel,
  showboxRoomTokenUrl,
  showboxFeatureCoords,
  wantsHostJoin,
  clearShowboxJoinParams,
  GuestMode,
  MirrorSource,
  MirrorRole,
  ShowboxIntermission,
} from './context'
import { openBroadcastPanel } from './broadcast-panel'
import { connectViewer } from './viewer'

export default class Showbox extends Feature2D<ShowboxRecord> {
  static metadata: FeatureMetadata = {
    title: 'Showbox',
    subtitle: 'go live in the metaverse',
    type: 'showbox',
    image: '',
  }
  static template = {
    type: 'showbox',
    scale: [2, 1, 0],
    guestMode: 'cohost',
  } as FeatureTemplate

  livekitRoom: Room | null = null
  broadcastRoom: Room | null = null
  scaleAspectLocked = true // screens keep their aspect ratio by default (editor lock + corner-resize honor this)
  broadcastPanel: HTMLDivElement | null = null
  broadcastPanelSidebar = false
  broadcastChatDispose: (() => void) | null = null
  thumbCanvas: HTMLCanvasElement | null = null
  thumbInterval: ReturnType<typeof setInterval> | null = null
  liveTimerInterval: ReturnType<typeof setInterval> | null = null
  liveStartedAt: number | null = null
  audioMeterRaf: number | null = null
  audioMeterCtx: AudioContext | null = null
  streamAudioEls: HTMLAudioElement[] = []
  streamSpatialByEl = new Map<HTMLAudioElement, SpatialAudio>()
  streamVolumeInterval: ReturnType<typeof setInterval> | null = null
  hasActiveVideo = false
  // one pane per publisher: the editor anchor + up to 4 guests, in arrival order.
  // 'local' is our own camera when broadcasting; remote publishers key by identity prefix.
  cohostPanes: { key: string; el: HTMLVideoElement; hadFrame: boolean; editor: boolean }[] = []
  cohostLiveSince = 0
  cohostCanvas: HTMLCanvasElement | null = null
  cohostCompositeEl: HTMLVideoElement | null = null
  cohostCompositeRaf: number | null = null
  cohostMonitorEls: HTMLAudioElement[] = []
  cohostCompositeAttached = false
  syncCohostPreview: (() => void) | null = null
  cohostCompositeRetryRaf: number | null = null
  milestonePollInterval: ReturnType<typeof setInterval> | null = null
  onViewerCountTick: ((roomTotal: number) => void) | null = null
  celebratedMilestones = new Set<number>()
  lastCelebrateAt = 0
  lastCelebrateN = 0
  viewerRoomFull = false
  viewerConnecting = false
  // the in-flight connectViewer, so a caller arriving mid-connect can await it instead of no-oping
  viewerConnectPromise: Promise<void> | null = null
  liveChatAnnounced = false
  walkAwayWarned = false
  broadcastLost = false
  broadcastDockLiveDot: HTMLElement | null = null
  broadcastDockLiveLabel: HTMLElement | null = null
  broadcastDockStatusEl: HTMLElement | null = null
  mobileBroadcastHooksClear: (() => void) | null = null
  mobilePreviewVideoEl: HTMLVideoElement | null = null
  syncMobilePreviewDock: (() => void) | null = null
  broadcastLiveTracks: any[] | null = null
  broadcastLiveVideoTrack: any = null
  broadcastLiveAudioTrack: any = null
  broadcastReconnectAttempts = 0
  broadcastReconnecting = false
  broadcastDisconnectStrikes = 0
  broadcastCameraLost = false
  broadcastStopping = false
  cameraHealthStrikes = 0
  cameraEndedTimer: ReturnType<typeof setTimeout> | null = null
  cameraResumeGen = 0
  broadcastCameraReconnectBtn: HTMLButtonElement | null = null
  mobileFlipFacing: 'user' | 'environment' = 'user'
  viewerConnectGen = 0
  localBroadcastVideoEl: HTMLVideoElement | null = null
  mirrorVideoIdentity: string | null = null
  // the actual track behind mirrorVideoIdentity - a reconnect delivers a new track under the
  // same identity, and comparing only the id left mirrors frozen on the dead element
  mirrorVideoTrack: any = null
  angleVideoTrack: any = null
  anglePanel: HTMLDivElement | null = null
  viewerRetryInterval: ReturnType<typeof setInterval> | null = null
  viewerReconnectAttempts = 0
  viewerReconnecting = false
  viewerDisconnectStrikes = 0
  onlineReconnectWired = false
  streamAttachRetryInterval: ReturnType<typeof setInterval> | null = null
  streamAttachAttempts = 0
  mirrorRefreshTimer: ReturnType<typeof setTimeout> | null = null
  guestJwtRefreshInterval: ReturnType<typeof setInterval> | null = null
  hostJoinLoginPending = false
  joinDockAutoOpened = false
  hostJoinAutoOpenStarted = false
  hostDockAutoOpenedAt = 0
  meshLetterboxRaf: number | null = null
  meshLetterboxCanvas: HTMLCanvasElement | null = null
  // intermission ("starting soon" / "be right back"): a raise-able animated standby card.
  // null when the show is running normally; set locally on the broadcaster and mirrored to
  // viewers over the existing ephemeral parcel-state channel (no backend).
  intermission: ShowboxIntermission | null = null
  intermissionRaf: number | null = null
  intermissionCanvas: HTMLCanvasElement | null = null
  intermissionPrevMic = false
  intermissionStatusInterval: ReturnType<typeof setInterval> | null = null
  // video FX (prototype): live audio analysis (level + bass/mid/treble + beat-punch envelope) tapped
  // from the dock meter, read by the fx processor so the visuals dance to the music; the active processor.
  fxAudio: FxAudio = { level: 0, bass: 0, mid: 0, treble: 0, punch: 0 }
  broadcastFxProcessor: VideoFxProcessor | null = null
  fxAutoTimer: ReturnType<typeof setTimeout> | null = null

  roomName() {
    return `parcel-${this.parcel.id}`
  }

  activeLiveShowboxUuid() {
    const live = (this.parcel.state as any).__showbox_live
    return typeof live === 'string' ? live : null
  }

  streamTargetsThisShowbox() {
    const live = this.activeLiveShowboxUuid()
    return !!live && live === this.uuid
  }

  isMirror() {
    const primary = this.parcel.primaryShowboxUuid()
    return !!primary && primary !== this.uuid
  }

  // a mirror shows the primary showbox video (muted) whenever a stream is live on the parcel.
  // __showbox_live is ephemeral (broadcast-only, not persisted) and our own broadcast isn't a
  // remote participant on this client, so fall back to the actual room video as the source of truth.
  mirrorsActiveStream() {
    if (!this.isMirror()) return false
    // angle mirrors only care about their own named track, not the primary go-live flag
    if (this.isAngleMirror()) return this.hasAngleFeed()
    return !!this.activeLiveShowboxUuid() || this.mirrorHasVideoSource()
  }

  mirrorHasVideoSource() {
    // angle feeds only belong to their own mirror - don't let them count as the primary stream
    for (const p of (this.mirrorSourceRoom() as any)?.participants?.values() ?? []) {
      for (const pub of p.videoTracks?.values() ?? []) {
        if (!this.isAngleTrackName(pub.trackName)) return true
      }
    }
    const primary = this.parcel.primaryShowbox() as any
    for (const pub of primary?.broadcastRoom?.localParticipant?.videoTracks?.values() ?? []) {
      if (!this.isAngleTrackName(pub.trackName)) return true
    }
    return false
  }

  // a mirror set to "second camera" shows a dedicated video-only track named with its own uuid,
  // not the primary's stream. any broadcaster can publish one.
  isAngleMirror() {
    // second screen is the default for a mirror now - only an explicit angleMode === false makes it a plain mirror.
    return this.isMirror() && this.description.angleMode !== false
  }

  hasAngleFeed() {
    if (this.angleVideoTrack) return true
    for (const p of (this.livekitRoom as any)?.participants?.values() ?? []) {
      for (const pub of p.videoTracks.values()) {
        if (pub.trackName === this.uuid) return true
      }
    }
    return false
  }

  // uuids of every angle-mode showbox on the parcel - their feeds are routed by track name, not by role
  angleTrackNames(): string[] {
    return this.parcel
      .getFeaturesByType('showbox')
      .filter((b: any) => b?.description?.angleMode)
      .map((b) => b.uuid)
  }

  isAngleTrackName(name: string | undefined) {
    return !!name && this.angleTrackNames().includes(name)
  }

  displaysStream() {
    return this.streamTargetsThisShowbox() || this.mirrorsActiveStream()
  }

  reconcileActiveStream() {
    if (this.broadcastRoom || this.angleVideoTrack) return
    if (this.displaysStream()) {
      // a mirror promoted to primary (old primary deleted mid-show) starts with no room
      if (!this.livekitRoom && this.needsViewerRoom() && this.isInCurrentParcel) this.scheduleViewerRetry()
      this.tryAttachExistingStream()
      if (!this.hasActiveVideo) this.scheduleStreamAttachRetry()
      return
    }
    this.stopStreamAttachRetry()
    if (!this.hasActiveVideo) {
      this.setPreview()
      return
    }
    this.hasActiveVideo = false
    this.mirrorVideoIdentity = null
    this.mirrorVideoTrack = null
    if (this.isCohostMode()) this.stopCohostComposite()
    this.setPreview()
  }

  // plain mirrors subscribe nothing themselves - the primary showbox's viewer room is the track
  // source. a room per mirror downloaded and decoded the same stream n times, which is what
  // killed phones. angle mirrors keep their own room (named track + walk-up publishing).
  mirrorSourceRoom() {
    if (this.isMirror() && !this.isAngleMirror()) {
      return (this.parcel.primaryShowbox() as any)?.livekitRoom ?? this.livekitRoom
    }
    return this.livekitRoom
  }

  // one <video> per track: every attach() spawns a fresh element, and each element is another
  // hardware decoder on ios. reuse the element the track already has.
  attachedVideoEl(track: any): HTMLVideoElement {
    const existing = track?.attachedElements?.find((e: any) => e instanceof HTMLVideoElement)
    return (existing as HTMLVideoElement) ?? (track.attach() as HTMLVideoElement)
  }

  // angle mirrors show only the track named with their uuid (a dedicated second camera), muted. no echo fallback.
  refreshAngleVideo() {
    const attach = (track: any) => {
      if (!track) return false
      if (this.mirrorVideoIdentity !== this.uuid || this.mirrorVideoTrack !== track) {
        this.attachVideoToMesh(this.attachedVideoEl(track), true)
        this.mirrorVideoIdentity = this.uuid
        this.mirrorVideoTrack = track
        this.stopStreamAttachRetry()
      }
      return true
    }
    // our own walk-up broadcast to this mirror - not a remote participant on this client
    if (this.angleVideoTrack && attach(this.angleVideoTrack)) return
    let pendingPub = false
    for (const p of (this.livekitRoom as any)?.participants?.values() ?? []) {
      for (const pub of p.videoTracks.values()) {
        if (pub.trackName !== this.uuid) continue
        pendingPub = true
        if (pub.track && pub.isSubscribed && attach(pub.track)) return
      }
    }
    // publication exists or we already have a frame - don't flash back to placeholder mid-subscribe
    if (pendingPub || (this.hasActiveVideo && this.mirrorVideoIdentity === this.uuid)) return
    if (this.hasActiveVideo) {
      this.hasActiveVideo = false
      this.mirrorVideoIdentity = null
      this.mirrorVideoTrack = null
      this.setPreview()
    }
  }

  // owners/collaborators + valid guest links can drive a second camera into an angle mirror
  canBroadcastAngle() {
    return this.isAngleMirror() && (this.parcel.canEdit || isGuestForShowbox(this.uuid) || isGuestOnParcel(this.parcel.id))
  }

  // walk up to an angle mirror and push your camera straight to it (video only, no audio, no __showbox_live).
  // published on the viewer room - its token already grants canPublish for authorized users.
  async startAngleBroadcast(deviceId?: string, useScreen = false): Promise<boolean> {
    // capture first, in the click gesture - getDisplayMedia only opens the OS picker when called synchronously inside it.
    let track: any
    try {
      if (useScreen) {
        // share a window/screen, video only - a side-feed never carries audio. the browser picker chooses what.
        ;[track] = await createLocalScreenTracks({ audio: false })
      } else {
        // exact: a plain string deviceId is only a preference, so the browser hands back the already-running primary camera. Force the pick.
        track = await createLocalVideoTrack(deviceId ? { deviceId: { exact: deviceId } } : undefined)
      }
    } catch (e) {
      console.error('showbox: angle capture failed', e)
      return false
    }
    if (!track) return false // screenshare picker can resolve empty - never publish undefined
    return this.publishAngleTrack(track)
  }

  // publish an already-captured track to this mirror. split out so the capture can happen in-gesture (see shareScreenToSecondScreen).
  async publishAngleTrack(track: any): Promise<boolean> {
    if (this.angleVideoTrack) {
      try {
        track.stop()
      } catch {}
      return true
    }
    if (!this.livekitRoom) await this.connectViewer()
    const lp = (this.livekitRoom as any)?.localParticipant
    if (!lp) {
      // viewer room never came up (token/connect failed) - don't leave the capture running
      console.error('showbox: angle publish skipped, no viewer room')
      try {
        track.stop()
      } catch {}
      return false
    }
    this.angleVideoTrack = track
    try {
      await lp.publishTrack(track, { name: this.uuid })
    } catch (e) {
      console.error('showbox: angle capture failed to publish', e)
      try {
        track.stop()
      } catch {}
      this.angleVideoTrack = null
      return false
    }
    // browser "stop sharing" bar (or a yanked camera) ends the track - drop back to idle so the screen isn't frozen.
    track.mediaStreamTrack?.addEventListener('ended', () => this.stopAngleBroadcast())
    this.attachVideoToMesh(track.attach() as HTMLVideoElement, true)
    this.mirrorVideoIdentity = this.uuid
    this.stopStreamAttachRetry()
    return true
  }

  closeAnglePanel() {
    this.anglePanel?.remove()
    this.anglePanel = null
  }

  // a small dialog on the angle mirror itself: pick a camera, broadcast it to just this screen.
  openAnglePanel(cameraOnly = false) {
    if (this.anglePanel) {
      this.closeAnglePanel()
      return
    }
    exitPointerLock()
    const panel = document.createElement('div')
    this.anglePanel = panel
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '999999',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: mobile ? 'calc(100vw - 2rem)' : '320px',
      background: '#0d0d0d',
      color: '#f5f5f0',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      fontFamily: '"Source Code Pro", monospace',
      fontSize: mobile ? '15px' : '13px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
    })

    const title = document.createElement('div')
    title.textContent = cameraOnly ? 'add camera' : 'second screen'
    title.style.fontWeight = 'bold'
    title.style.fontSize = mobile ? '16px' : '14px'

    const hint = document.createElement('small')
    hint.textContent = cameraOnly ? 'pick a camera. video only, no audio.' : 'share a screen or add a camera. video only, no audio.'
    hint.style.color = '#888'

    const sel = document.createElement('select')
    Object.assign(sel.style, { width: '100%', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: mobile ? '8px' : '4px' })
    if (mobile) Object.assign(sel.style, { fontSize: '16px', minHeight: '44px' })

    const status = document.createElement('div')
    Object.assign(status.style, { color: '#888', fontSize: '12px', minHeight: '14px' })

    const btnStyle = { background: 'var(--red)', color: '#fff', border: '0', padding: mobile ? '12px' : '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }

    const shareScreenBtn = document.createElement('button')
    shareScreenBtn.type = 'button'
    shareScreenBtn.textContent = 'share screen'
    Object.assign(shareScreenBtn.style, btnStyle, { flex: '1' }) // shares the idle button row
    if (mobile || cameraOnly) shareScreenBtn.style.display = 'none' // phone screenshare is unreliable; cameraOnly hides it entirely

    const addCameraBtn = document.createElement('button')
    addCameraBtn.type = 'button'
    addCameraBtn.textContent = 'add camera'
    Object.assign(addCameraBtn.style, btnStyle, { flex: '1' })

    const stopBtn = document.createElement('button')
    stopBtn.type = 'button'
    stopBtn.textContent = 'stop'
    Object.assign(stopBtn.style, btnStyle) // stands alone - no flex stretch in the column
    stopBtn.onclick = () => {
      this.stopAngleBroadcast()
      this.closeAnglePanel()
    }

    const start = async (useScreen: boolean) => {
      shareScreenBtn.disabled = true
      addCameraBtn.disabled = true
      status.textContent = useScreen ? 'pick a screen...' : 'starting camera...'
      const ok = await this.startAngleBroadcast(useScreen ? undefined : sel.value || undefined, useScreen)
      if (ok) {
        this.closeAnglePanel()
      } else {
        shareScreenBtn.disabled = false
        addCameraBtn.disabled = false
        status.textContent = useScreen ? 'could not share that screen - try again' : 'could not start that camera - try another'
      }
    }
    shareScreenBtn.onclick = () => start(true)
    addCameraBtn.onclick = () => start(false)

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'cancel'
    Object.assign(cancel.style, { background: 'transparent', color: '#888', border: '0', padding: '4px 0', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' })
    cancel.onclick = () => this.closeAnglePanel()

    if (this.angleVideoTrack) {
      panel.append(title, stopBtn, cancel)
    } else {
      const btnRow = document.createElement('div')
      Object.assign(btnRow.style, { display: 'flex', gap: '0.5rem' })
      btnRow.append(shareScreenBtn, addCameraBtn)
      panel.append(title, hint, sel, btnRow, status, cancel)
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        devices
          .filter((d) => d.kind === 'videoinput')
          .forEach((d, i) => {
            const o = document.createElement('option')
            o.value = d.deviceId
            o.textContent = d.label || `camera ${i + 1}`
            sel.appendChild(o)
          })
      })
    }
    document.body.appendChild(panel)
  }

  stopAngleBroadcast(silent = false) {
    if (!this.angleVideoTrack) return
    try {
      ;(this.livekitRoom as any)?.localParticipant?.unpublishTrack(this.angleVideoTrack, true)
    } catch {}
    try {
      this.angleVideoTrack.stop()
    } catch {}
    this.angleVideoTrack = null
    if (silent) return
    this.hasActiveVideo = false
    this.mirrorVideoIdentity = null
    this.mirrorVideoTrack = null
    this.refreshAngleVideo()
    // refreshAngleVideo only repaints when it had an active feed; clearing it first leaves the last frame
    // frozen, so restore the idle "broadcast to this mirror" CTA when nothing else is driving the screen.
    if (!this.hasActiveVideo) this.setPreview()
  }

  // host quick-share from the dock: pick an idle second screen or drop a fresh one, then push your screen to it.
  // reusable - a "new" screen persists as a real feature, so next time it shows up as "existing".
  openShareScreenChooser() {
    const mirrors = (this.parcel.getFeaturesByType('showbox') as Showbox[]).filter((f) => f.isAngleMirror() && !f.angleVideoTrack)
    if (!mirrors.length) {
      if (!this.parcel.canEdit) return void app.showSnackbar("you can't add a screen on this parcel", PanelType.Warning)
      return void this.shareScreenToSecondScreen('new') // nothing to reuse - go straight to a new one
    }

    exitPointerLock()
    const panel = document.createElement('div')
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '999999',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '280px',
      background: '#0d0d0d',
      color: '#f5f5f0',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      fontFamily: '"Source Code Pro", monospace',
      fontSize: '13px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
    })
    const title = document.createElement('div')
    title.textContent = 'share a screen'
    title.style.fontWeight = 'bold'
    const close = () => panel.remove()
    const mkBtn = (label: string, onClick: () => void) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      Object.assign(b.style, { background: 'var(--red)', color: '#fff', border: '0', padding: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' })
      b.onclick = () => {
        close()
        onClick()
      }
      return b
    }
    panel.append(title)
    if (this.parcel.canEdit) panel.append(mkBtn('new screen', () => void this.shareScreenToSecondScreen('new')))
    mirrors.forEach((m, i) => panel.append(mkBtn(`existing screen ${i + 1}`, () => void this.shareScreenToSecondScreen(m))))
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'cancel'
    Object.assign(cancel.style, { background: 'transparent', color: '#888', border: '0', padding: '4px 0', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' })
    cancel.onclick = close
    panel.append(cancel)
    document.body.appendChild(panel)
  }

  private sharingScreenPending = false

  // new -> drop a second screen beside your stage screen, already showing your share; slide/resize it with the handles. existing -> reuse one.
  async shareScreenToSecondScreen(target: Showbox | 'new') {
    if (target === 'new' && !this.parcel.canEdit) {
      app.showSnackbar("you can't add a screen on this parcel", PanelType.Warning)
      return
    }
    if (this.sharingScreenPending) return // ignore a second click while a share is mid-flight
    this.sharingScreenPending = true
    try {
      // capture the screen first, synchronously in the click gesture - else the OS picker silently no-ops and we leave a stray empty screen.
      let track: any
      try {
        ;[track] = await createLocalScreenTracks({ audio: false })
      } catch {
        return // cancelled/blocked picker - spawn nothing
      }
      if (!track) return

      let mirror: Showbox | null = target === 'new' ? null : target
      if (target === 'new') {
        const tool = window.ui?.featureTool
        const engine = this.scene.getEngine()
        const pick = this.scene.pick(engine.getRenderWidth() / 2, engine.getRenderHeight() / 2)
        if (!tool || !pick?.pickedPoint) {
          try {
            track.stop()
          } catch {}
          app.showSnackbar('look toward your stage, then try again', PanelType.Warning)
          return
        }
        const feature = (await tool.spawn(pick, { ...Showbox.template, angleMode: true })) as Showbox | null
        if (feature) {
          // land it right beside the primary stage screen, facing the same way, so it's in view and oriented - then drag/resize.
          const right = this.mesh ? this.mesh.getDirection(new BABYLON.Vector3(1, 0, 0)).normalize() : new BABYLON.Vector3(1, 0, 0)
          const offset = (this.scale?.x ?? 2) / 2 + 1.3
          feature.set({ position: this.position.add(right.scale(offset)).asArray() as [number, number, number], rotation: this.rotation.asArray() as [number, number, number] })
        }
        mirror = feature
      }

      if (!mirror) {
        try {
          track.stop()
        } catch {}
        app.showSnackbar('could not start the screen share', PanelType.Warning)
        return
      }
      // publishAngleTrack owns the track from here (it stops it on its own failure paths) - don't double-stop.
      const ok = await mirror.publishAngleTrack(track)
      if (!ok) app.showSnackbar('could not start the screen share', PanelType.Warning)
    } finally {
      this.sharingScreenPending = false
    }
  }

  // mirrors show the chosen source muted (default: whoever is live, host preferred), so every mirror is consistent
  refreshMirrorVideo() {
    if (!this.isMirror() || this.broadcastRoom) return
    // primary on a standby card -> the mirror shows the same card, not a frozen last frame
    if (this.isIntermissionActive()) {
      this.drawIntermissionCard()
      return
    }
    if (this.isAngleMirror()) {
      if (!this.livekitRoom) return
      return this.refreshAngleVideo()
    }
    const pick = this.pickVideoSource(true)
    if (!pick) {
      if (this.hasRemoteBroadcaster()) return
      if (this.hasActiveVideo) {
        this.hasActiveVideo = false
        this.mirrorVideoIdentity = null
        this.mirrorVideoTrack = null
        this.setPreview()
      }
      return
    }
    if (this.hasActiveVideo && this.mirrorVideoIdentity === pick.id && this.mirrorVideoTrack === pick.track) return
    this.attachVideoToMesh(this.attachedVideoEl(pick.track), true)
    this.mirrorVideoIdentity = pick.id
    this.mirrorVideoTrack = pick.track
    this.stopStreamAttachRetry()
  }

  tryAttachExistingStream() {
    if (this.broadcastRoom) return
    if (this.isMirror()) {
      // plain mirrors have no room of their own - they read the primary's
      this.refreshMirrorVideo()
      return
    }
    if (!this.livekitRoom) return
    this.syncExistingStreamAudio()
    if (this.isCohostMode()) {
      if (this.hasActiveVideo) return
      this.syncExistingCohostVideos()
      this.updateCohostComposite()
      return
    }
    if (this.hasActiveVideo) return
    const pick = this.pickVideoSource(false)
    if (!pick) return
    this.attachVideoToMesh(this.attachedVideoEl(pick.track), true)
    this.startBroadcastAudio()
    this.stopStreamAttachRetry()
  }

  isShowLive() {
    return !!this.broadcastRoom || this.hasActiveVideo || this.hasRemoteBroadcaster()
  }

  receiveState(state: ShowboxCelebrateState) {
    if (state && 'intermission' in state) this.applyIntermissionState(state.intermission ?? null)
    const n = state?.celebrate
    const at = state?.at ?? 0
    if (!n || n < 10 || !at || !this.isInCurrentParcel || !this.isShowLive()) return
    if (at <= this.lastCelebrateAt || n <= this.lastCelebrateN) return
    this.lastCelebrateAt = at
    this.lastCelebrateN = n
    this.runCelebrate(n)
  }

  // viewer side: the broadcaster's raise/drop arrives on this showbox's state slice. the host drives
  // its own card locally (and would only echo its own patch), so it ignores this.
  applyIntermissionState(next: ShowboxIntermission | null) {
    if (this.broadcastRoom) return
    const cur = this.intermission
    const changed = !!cur !== !!next || (!!cur && !!next && cur.at !== next.at)
    if (!changed) return
    this.intermission = next
    if (this.intermission) {
      this.drawIntermissionCard()
    } else {
      this.stopIntermissionCard()
      this.hasActiveVideo = false
      // the card replaced the mesh material but left cohostCompositeAttached=true, so updateCohostComposite
      // would skip re-pinning the composite and the viewer stays stuck on the card. force a re-attach.
      this.cohostCompositeAttached = false
      this.reconcileActiveStream()
    }
    // plain mirrors read the primary's flag - nudge them to repaint too
    this.refreshParcelMirrors()
  }

  playCelebrateMoves(anims: Animations[], gapMs: number) {
    const persona = window.persona
    const controls = window.connector?.controls
    if (!persona || !controls || !anims.length) return
    anims.forEach((anim, i) => {
      setTimeout(() => {
        if (this.disposed) return
        persona.playEmote(anim)
      }, i * gapMs)
    })
  }

  runCelebrate(n: number) {
    const pos = this.absolutePosition
    const { emojis, staggerMs } = celebrateBursts(n)
    emojis.forEach((emoji, i) => {
      setTimeout(() => {
        if (this.disposed) return
        try {
          emoteParticles(emoji, pos, this.scene)
        } catch {}
      }, i * staggerMs)
    })

    const uuid = window.persona?.uuid ?? ''
    const { anims, gapMs } = celebrateMoves(n, uuid)
    this.playCelebrateMoves(anims, gapMs)

    app.showSnackbar(celebrateLabel(n), PanelType.Success)
  }

  runTipCelebrate(amount: number) {
    let n = 10
    if (amount >= 0.05) n = 50
    else if (amount >= 0.01) n = 25
    this.runCelebrate(n)
  }

  broadcastRoomParticipantCount() {
    const room = this.broadcastRoom
    if (!room) return 0
    try {
      const n = (room as any).participants?.size
      if (typeof n === 'number' && n > 0) return n
    } catch {}
    return 0
  }

  async fetchViewerCount() {
    const live = this.broadcastRoomParticipantCount()
    if (live > 0) return live
    try {
      const r = await fetch(`/api/rooms/${this.roomName()}`)
      if (!r.ok) return 0
      const j = await r.json().catch(() => null)
      return j?.room?.numParticipants ?? 0
    } catch {
      return 0
    }
  }

  guestLiveUrl(token: string) {
    return `${window.location.origin}/live/${token}`
  }

  canManageGuestPasses() {
    return this.parcel.canEdit
  }

  async fetchActiveGuestPassToken() {
    try {
      const r = await fetch(`/api/parcels/${this.parcel.id}/guest-passes?feature_uuid=${encodeURIComponent(this.uuid)}`, { credentials: 'include', cache: 'no-store' })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) return null
      const pass = (j.passes ?? []).find((p: any) => !p.revoked_at)
      return pass?.token ?? null
    } catch {
      return null
    }
  }

  async createGuestPassToken() {
    if (!this.canManageGuestPasses()) return null
    try {
      const r = await fetch(`/api/parcels/${this.parcel.id}/guest-passes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ feature_uuid: this.uuid }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) return null
      return j.pass?.token ?? null
    } catch {
      return null
    }
  }

  async resolveGuestShareUrl() {
    let token = await this.fetchActiveGuestPassToken()
    if (!token && this.canManageGuestPasses()) {
      token = await this.createGuestPassToken()
      if (!token) app.showSnackbar('could not create guest link', PanelType.Warning)
    }
    if (!token) return null
    return this.guestLiveUrl(token)
  }

  async shareShowUrl(url: string, text: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'voxels show', text, url })
      } catch (e) {
        if ((e as DOMException)?.name !== 'AbortError') {
          navigator.clipboard.writeText(url).catch(() => {})
          app.showSnackbar('link copied - paste in your app', PanelType.Success)
        }
      } finally {
        if (mobile) refreshMobileCanvasAfterReturn()
      }
      return
    }
    navigator.clipboard.writeText(url).catch(() => {})
    app.showSnackbar('link copied - paste in your app', PanelType.Success)
  }

  stopMilestonePoll() {
    if (this.milestonePollInterval) {
      clearInterval(this.milestonePollInterval)
      this.milestonePollInterval = null
    }
    this.onViewerCountTick = null
    this.celebratedMilestones.clear()
  }

  fireMilestone(n: number) {
    const at = Date.now()
    this.lastCelebrateAt = at
    this.lastCelebrateN = n
    try {
      this.parcel.sendStatePatch({ [this.uuid]: { celebrate: n, at } })
    } catch {}
    this.runCelebrate(n)
  }

  // Warn the broadcaster before they wander far enough for their parcel to unload, which disposes
  // the showbox and kills their stream. Fires once when they cross the threshold, re-arms on return.
  // Snackbar works the same on desktop and mobile.
  warnIfWalkingAway() {
    if (!this.broadcastRoom || this.disposed) return
    // Just went live - the current-parcel lookup can read stale for a beat and false-trigger the warning.
    if (this.liveStartedAt && Date.now() - this.liveStartedAt < 5000) return
    // Only warn once they've actually left the parcel. A raw distance-to-screen check false-fires while
    // standing still (big parcels, third-person camera, low draw distance). Leaving the parcel is the
    // real precursor to it unloading and killing the stream.
    if (!this.isInCurrentParcel) {
      if (!this.walkAwayWarned) {
        this.walkAwayWarned = true
        app.showSnackbar('walk back toward your showbox - go too far and your stream ends', PanelType.Warning)
      }
    } else {
      this.walkAwayWarned = false
    }
  }

  startMilestonePoll() {
    this.stopMilestonePoll()
    const tick = async () => {
      if (!this.broadcastRoom || this.disposed) return
      const lost = this.checkBroadcastHealth()
      if (lost) {
        this.onBroadcastLost(lost)
        return
      }
      this.warnIfWalkingAway()
      void maybeRefreshGuestJwt()
      const count = await this.fetchViewerCount()
      this.onViewerCountTick?.(count)
      if (!count) return
      for (const m of VIEWER_MILESTONES) {
        if (count >= m && !this.celebratedMilestones.has(m)) {
          this.celebratedMilestones.add(m)
          this.fireMilestone(m)
        }
      }
    }
    this.milestonePollInterval = setInterval(tick, BROADCAST_HEALTH_POLL_MS)
    setTimeout(tick, BROADCAST_HEALTH_POLL_MS)
  }

  get volume() {
    if (typeof this.description.volume === 'number') {
      return Math.max(0, Math.min(this.description.volume, MAX_VOLUME))
    }
    return DEFAULT_VOLUME
  }

  get rolloffFactor() {
    if (typeof this.description.rolloffFactor === 'number') {
      return this.description.rolloffFactor
    }
    return 0
  }

  get audio() {
    return window._audio
  }

  effectiveStreamVolume() {
    const parcelVol = this.audio?.parcelOut.gain.value ?? 1
    return Math.min(1, Math.max(0, this.volume * parcelVol))
  }

  refreshStreamVolume() {
    const flatVol = this.effectiveStreamVolume()
    for (const el of this.streamAudioEls) {
      const spatial = this.streamSpatialByEl.get(el)
      if (spatial) {
        spatial.volume = this.volume
      } else {
        el.volume = flatVol
      }
    }
    for (const el of this.cohostMonitorEls) {
      el.volume = flatVol
    }
  }

  disposeStreamSpatial(el: HTMLAudioElement) {
    const spatial = this.streamSpatialByEl.get(el)
    if (!spatial) return
    try {
      spatial.dispose()
    } catch {}
    this.streamSpatialByEl.delete(el)
  }

  untrackStreamAudio(el: HTMLAudioElement) {
    const i = this.streamAudioEls.indexOf(el)
    if (i >= 0) this.streamAudioEls.splice(i, 1)
    this.disposeStreamSpatial(el)
    el.remove()
  }

  // removing a playing media element from the DOM does not stop it - the livekit track still
  // feeds it. kill the source before dropping the element or the audio stacks up per re-attach.
  silenceAudioEl(el: HTMLAudioElement) {
    try {
      el.pause()
      el.srcObject = null
    } catch {}
    el.remove()
  }

  wireStreamSpatial(el: HTMLAudioElement) {
    if (this.rolloffFactor <= 0 || !this.audio) return false
    // createMediaElementSource throws if the element is already wired to WebAudio - fall back to flat volume.
    try {
      const source = BABYLON.Engine.audioEngine?.audioContext?.createMediaElementSource(el)
      if (!source) return false
      const spatial = this.audio.createSpatialAudio({
        name: 'feature/showbox/stream',
        outputBus: AudioBus.Parcel,
        audioNode: source,
        absolutePosition: this.absolutePosition.clone(),
        rolloffFactor: this.rolloffFactor,
      })
      spatial.volume = this.volume
      this.streamSpatialByEl.set(el, spatial)
      el.volume = 1
      return true
    } catch {
      return false
    }
  }

  // audience audio normally lands in the TrackSubscribed handler, but livekit can deliver the
  // tracks before the __showbox_live patch arrives - that handler bails on the flag check and
  // nothing else attaches audio, so the viewer gets a silent show. sync on every reconcile.
  syncExistingStreamAudio() {
    if (this.broadcastRoom || !this.livekitRoom || !wantsAudio()) return
    if (!this.streamTargetsThisShowbox()) return
    for (const p of (this.livekitRoom as any).participants?.values() ?? []) {
      for (const pub of p.audioTracks?.values() ?? []) {
        if (!pub.isSubscribed || !pub.track) continue
        const els: any[] = pub.track.attachedElements ?? []
        if (els.some((e) => this.streamAudioEls.includes(e))) continue
        const el = pub.track.attach() as HTMLAudioElement
        el.style.display = 'none'
        document.body.appendChild(el)
        this.trackStreamAudio(el, p.identity)
        this.duckLive()
      }
    }
    this.startBroadcastAudio()
  }

  trackStreamAudio(el: HTMLAudioElement, identity?: string) {
    if (identity) {
      const prefix = cohostIdentityPrefix(identity)
      for (let i = this.streamAudioEls.length - 1; i >= 0; i--) {
        const old = this.streamAudioEls[i] as HTMLAudioElement & { dataset: { streamPrefix?: string } }
        if (old.dataset?.streamPrefix === prefix) {
          this.untrackStreamAudio(old)
        }
      }
      el.dataset.streamPrefix = prefix
    }
    this.streamAudioEls.push(el)
    if (!this.wireStreamSpatial(el)) {
      el.volume = this.effectiveStreamVolume()
    }
    if (!this.streamVolumeInterval) {
      this.streamVolumeInterval = setInterval(() => this.refreshStreamVolume(), VOLUME_REFRESH_INTERVAL)
    }
  }

  stopStreamVolumePoll() {
    if (this.streamVolumeInterval) {
      clearInterval(this.streamVolumeInterval)
      this.streamVolumeInterval = null
    }
    for (const el of [...this.streamAudioEls]) {
      this.disposeStreamSpatial(el)
    }
    this.streamAudioEls = []
  }

  get guestMode(): GuestMode {
    return this.description.guestMode === 'solo' ? 'solo' : 'cohost'
  }

  get screenShape(): 'landscape' | 'portrait' {
    if (this.isMirror()) {
      const primary = this.parcel.primaryShowbox() as Showbox | undefined
      return primary?.description.screenShape === 'portrait' ? 'portrait' : 'landscape'
    }
    return this.description.screenShape === 'portrait' ? 'portrait' : 'landscape'
  }

  isPortraitScreen() {
    return this.screenShape === 'portrait'
  }

  meshVideoSize() {
    return this.isPortraitScreen() ? { w: PORTRAIT_MESH_W, h: PORTRAIT_MESH_H } : { w: LANDSCAPE_MESH_W, h: LANDSCAPE_MESH_H }
  }

  isCohostMode() {
    return this.guestMode === 'cohost'
  }

  isSoloGuestMode() {
    return this.guestMode === 'solo'
  }

  collectVideoSources() {
    const byRole: Partial<Record<MirrorRole, { track: any; id: string }>> = {}
    let first: { track: any; id: string } | null = null
    const consider = (track: any, identity: string, trackName?: string) => {
      if (!track) return
      if (this.isAngleTrackName(trackName)) return
      const role = this.publisherRole(identity)
      if (!byRole[role]) byRole[role] = { track, id: identity }
      if (!first) first = { track, id: identity }
    }
    for (const p of (this.mirrorSourceRoom() as any)?.participants?.values() ?? []) {
      for (const pub of p.videoTracks.values()) {
        if (pub.isSubscribed) consider(pub.track, p.identity, pub.trackName)
      }
    }
    const local = (this.parcel.primaryShowbox() as any)?.broadcastRoom?.localParticipant
    for (const pub of local?.videoTracks?.values() ?? []) {
      consider(pub.track, local.identity, pub.trackName)
    }
    return { byRole, first }
  }

  pickVideoSource(forMirror = false): { track: any; id: string } | null {
    const { byRole, first } = this.collectVideoSources()
    if (!first) return null
    const want = forMirror ? this.mirrorSource : 'auto'
    const solo = forMirror ? (this.parcel.primaryShowbox() as Showbox)?.guestMode === 'solo' : this.isSoloGuestMode()
    if (want !== 'auto' && byRole[want]) return byRole[want]!
    if (solo) return byRole.guest ?? byRole.host ?? byRole.collaborator ?? first
    return byRole.host ?? byRole.collaborator ?? byRole.guest ?? first
  }

  scheduleMirrorRefresh() {
    if (!this.isMirror() || this.disposed) return
    if (this.mirrorRefreshTimer) clearTimeout(this.mirrorRefreshTimer)
    this.mirrorRefreshTimer = setTimeout(() => {
      this.mirrorRefreshTimer = null
      if (!this.isMirror() || this.disposed) return
      this.refreshMirrorVideo()
    }, 500)
  }

  // plain mirrors run no room of their own, so the primary's room events drive their refresh
  refreshParcelMirrors() {
    if (this.isMirror()) return
    for (const f of this.parcel.getFeaturesByType('showbox')) {
      if (f !== this) (f as any).scheduleMirrorRefresh?.()
    }
  }

  hasRemoteBroadcaster() {
    if (!this.displaysStream()) return false
    for (const p of (this.mirrorSourceRoom() as any)?.participants?.values() ?? []) {
      if (p?.audioTracks?.size > 0) return true
      // angle feeds are video-only side channels, not a live show
      for (const pub of p?.videoTracks?.values() ?? []) {
        if (!this.isAngleTrackName(pub.trackName)) return true
      }
    }
    return false
  }

  // Before we drop __showbox_live, check if another co-host is still publishing.
  hasOtherLivePublishers() {
    const room = this.broadcastRoom ?? this.livekitRoom
    if (!room) return false
    try {
      for (const p of (room as any).participants?.values() ?? []) {
        for (const pub of p.videoTracks.values()) {
          if (pub.track) return true
        }
      }
    } catch {}
    return false
  }

  ensureShowboxLiveFlag() {
    if (!this.broadcastRoom || this.streamTargetsThisShowbox()) return
    try {
      this.parcel.sendStatePatch({ __showbox_live: this.uuid })
    } catch {}
  }

  clearBroadcastDockUi() {
    this.broadcastDockLiveDot = null
    this.broadcastDockLiveLabel = null
    this.broadcastDockStatusEl = null
    this.broadcastLost = false
    this.broadcastReconnecting = false
    this.broadcastReconnectAttempts = 0
    this.broadcastDisconnectStrikes = 0
    this.broadcastCameraLost = false
    this.cameraHealthStrikes = 0
    if (this.cameraEndedTimer) {
      clearTimeout(this.cameraEndedTimer)
      this.cameraEndedTimer = null
    }
    this.broadcastStopping = false
    this.cameraResumeGen++
    this.broadcastCameraReconnectBtn = null
    this.broadcastLiveTracks = null
    this.broadcastLiveVideoTrack = null
    this.broadcastLiveAudioTrack = null
    this.mobilePreviewVideoEl = null
    this.syncMobilePreviewDock = null
    this.mobileBroadcastHooksClear?.()
    this.mobileBroadcastHooksClear = null
  }

  sidebarDock() {
    return !mobile
  }

  dismissBroadcastPanel() {
    if (this.broadcastPanel && broadcastDockEl.el === this.broadcastPanel) broadcastDockEl.el = null
    this.broadcastPanel?.remove()
    this.broadcastPanel = null
    this.broadcastPanelSidebar = false
    if (this.sidebarDock()) closeBroadcastSidebar()
  }

  applySidebarDockStyles(panel: HTMLDivElement) {
    Object.assign(panel.style, {
      position: 'relative',
      zIndex: 'auto',
      inset: 'auto',
      top: 'auto',
      right: 'auto',
      left: 'auto',
      bottom: 'auto',
      transform: 'none',
      width: '100%',
      maxWidth: 'none',
      maxHeight: 'none',
      boxShadow: 'none',
      // sidebar already pads and paints the column - don't stack the old overlay chrome
      padding: '0',
      background: 'transparent',
      color: 'inherit',
    })
  }

  attachBroadcastPanel(panel: HTMLDivElement) {
    if (!this.sidebarDock()) {
      document.body.appendChild(panel)
      return
    }
    this.broadcastPanelSidebar = true
    broadcastShowboxUuid.value = this.uuid
    sidebarClosed.value = false
    uiAsideTick.value++
    this.applySidebarDockStyles(panel)
    broadcastDockEl.el = panel
    let frames = 0
    const attach = () => {
      if (!this.broadcastPanel || this.broadcastPanel !== panel) return
      const mount = document.getElementById('showbox-broadcast-mount')
      if (mount) {
        mount.appendChild(panel)
        return
      }
      // ui=off / pane never mounted - don't spin forever, float over the world
      if (++frames > 90) {
        this.broadcastPanelSidebar = false
        Object.assign(panel.style, {
          position: 'fixed',
          zIndex: '999999',
          top: '12px',
          right: '12px',
          left: 'auto',
          bottom: 'auto',
          transform: 'none',
          width: '340px',
          maxHeight: 'calc(100vh - 24px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        })
        document.body.appendChild(panel)
        return
      }
      requestAnimationFrame(attach)
    }
    attach()
  }

  restoreLiveDockUi() {
    if (!this.broadcastDockLiveLabel) return
    this.broadcastDockLiveLabel.textContent = 'live'
    const header = this.broadcastDockLiveLabel.parentElement as HTMLElement | null
    if (header) header.style.color = 'var(--red)'
    if (this.broadcastDockLiveDot) {
      this.broadcastDockLiveDot.style.color = ''
      this.broadcastDockLiveDot.style.animation = 'showbox-live-pulse 1.2s ease-in-out infinite'
    }
    if (this.broadcastDockStatusEl) {
      this.broadcastDockStatusEl.style.display = 'none'
      this.broadcastDockStatusEl.textContent = ''
      this.broadcastDockStatusEl.style.color = ''
    }
  }

  maybeReconnectAfterDisconnect(reason: string) {
    if (this.broadcastLost || this.broadcastReconnecting || !this.broadcastPanel) return
    if (livekitRoomState(this.broadcastRoom) === 'reconnecting') return
    this.broadcastDisconnectStrikes++
    if (this.broadcastDisconnectStrikes < BROADCAST_DISCONNECT_STRIKES) {
      if (this.broadcastDockStatusEl && !this.broadcastLost) {
        this.broadcastDockStatusEl.style.display = 'block'
        this.broadcastDockStatusEl.textContent = 'connection unstable...'
        this.broadcastDockStatusEl.style.color = '#f5b942'
      }
      return
    }
    void this.tryBroadcastReconnect(reason)
  }

  wireBroadcastRoom(room: Room) {
    // going live on a screen: your voice goes out the showbox, so step off the avatar voice mic
    window.persona?.voiceChat?.setBroadcasting(true)
    setRadioBroadcasting(true)
    window._audio?.setBroadcasting(true)
    const bumpViewerCount = () => {
      const total = this.broadcastRoomParticipantCount()
      if (total > 0) this.onViewerCountTick?.(total)
    }
    room.on(RoomEvent.ParticipantConnected, bumpViewerCount)
    room.on(RoomEvent.ParticipantDisconnected, bumpViewerCount)
    room.on(RoomEvent.Disconnected, () => {
      if (this.broadcastLost || !this.broadcastRoom) return
      this.maybeReconnectAfterDisconnect('connection lost')
    })
    const reconnected = (RoomEvent as any).Reconnected
    if (reconnected) {
      room.on(reconnected, () => {
        if (this.broadcastLost) return
        this.broadcastReconnecting = false
        this.broadcastReconnectAttempts = 0
        this.broadcastDisconnectStrikes = 0
        this.ensureShowboxLiveFlag()
        this.restoreLiveDockUi()
        void this.refreshBroadcastPreview()
      })
    }
  }

  async refreshBroadcastPreview() {
    const track = this.broadcastLiveVideoTrack
    if (!track) return
    if (this.isCohostMode()) {
      this.syncBroadcastVideoFromTrack(track)
      return
    }
    try {
      const el = track.attach() as HTMLVideoElement
      el.muted = true
      el.playsInline = true
      this.localBroadcastVideoEl = el
      this.attachVideoToMesh(el, true)
      syncVideoElFromTrack(this.mobilePreviewVideoEl, track)
      this.syncMobilePreviewDock?.()
      this.parcel.getFeaturesByType('showbox').forEach((f) => (f as any).refreshMirrorVideo?.())
    } catch {}
  }

  async tryBroadcastReconnect(reason: string) {
    if (this.broadcastLost || this.broadcastReconnecting || !this.broadcastPanel) return
    const tracks = this.broadcastLiveTracks
    if (!tracks?.length) {
      this.onBroadcastLost(reason)
      return
    }
    if (this.broadcastReconnectAttempts >= BROADCAST_RECONNECT_MAX) {
      this.onBroadcastLost(reason)
      return
    }
    this.broadcastReconnectAttempts++
    this.broadcastReconnecting = true
    if (this.broadcastDockStatusEl) {
      this.broadcastDockStatusEl.style.display = 'block'
      this.broadcastDockStatusEl.textContent = `reconnecting (${this.broadcastReconnectAttempts}/${BROADCAST_RECONNECT_MAX})...`
      this.broadcastDockStatusEl.style.color = '#f5b942'
    }
    await new Promise((r) => setTimeout(r, 1000 * this.broadcastReconnectAttempts))
    try {
      if (livekitRoomState(this.broadcastRoom) === 'reconnecting') {
        this.broadcastReconnecting = false
        return
      }
      this.broadcastRoom?.disconnect()
      const res = await fetchShowboxRoomToken(showboxRoomTokenUrl(this.roomName(), true))
      if (!res?.token) throw new Error('no token')
      saveShowboxPublisherIdentity(this.roomName(), res.token)
      const room = new Room()
      this.broadcastRoom = room
      this.wireBroadcastRoom(room)
      await room.connect(LIVEKIT_URL, res.token)
      this.parcel.sendStatePatch({ [this.uuid]: { live: 1 }, __showbox_live: this.uuid })
      for (const t of tracks) {
        await room.localParticipant.publishTrack(t)
      }
      this.broadcastReconnecting = false
      this.broadcastReconnectAttempts = 0
      this.broadcastDisconnectStrikes = 0
      this.ensureShowboxLiveFlag()
      this.restoreLiveDockUi()
      await this.refreshBroadcastPreview()
      this.parcel.getFeaturesByType('showbox').forEach((f) => (f as any).refreshMirrorVideo?.())
    } catch {
      this.broadcastReconnecting = false
      if (this.broadcastReconnectAttempts >= BROADCAST_RECONNECT_MAX) this.onBroadcastLost(reason)
    }
  }

  // returns a plain-language reason when we look live in the dock but the stream is not healthy
  checkBroadcastHealth(): string | null {
    const room = this.broadcastRoom
    if (!room) return null
    if (this.broadcastReconnecting) return null
    const state = (room as any).state
    if (state === 'disconnected') {
      this.maybeReconnectAfterDisconnect('connection lost')
      return null
    }
    if (state === 'reconnecting') {
      if (this.broadcastDockStatusEl && !this.broadcastLost) {
        this.broadcastDockStatusEl.style.display = 'block'
        this.broadcastDockStatusEl.textContent = 'reconnecting...'
      }
      return null
    }
    if (this.broadcastDockStatusEl && !this.broadcastLost) {
      this.broadcastDockStatusEl.style.display = 'none'
      this.broadcastDockStatusEl.textContent = ''
    }
    if (!this.streamTargetsThisShowbox()) {
      this.ensureShowboxLiveFlag()
    }
    if (this.liveStartedAt && Date.now() - this.liveStartedAt < BROADCAST_LIVE_GRACE_MS) return null
    try {
      if (broadcastVideoTrackLive(room, this.broadcastLiveVideoTrack)) {
        this.noteCameraHealthy(room)
      } else {
        this.noteCameraUnhealthy()
      }
      this.broadcastDisconnectStrikes = 0
      if (this.streamTargetsThisShowbox()) {
        try {
          this.parcel.sendStatePatch({ __showbox_live: this.uuid })
        } catch {}
      }
    } catch {}
    return null
  }

  needsViewerRoom() {
    if (this.broadcastRoom && !this.isCohostMode()) return false
    if (this.broadcastRoom && this.isCohostMode()) return true
    // plain mirrors render from the primary's room - their own connection would download and
    // decode the same stream again (n mirrors = n decoders on ios)
    if (this.isMirror() && !this.isAngleMirror()) return false
    return this.displaysStream() || this.isInCurrentParcel
  }

  wireViewerRoom(room: Room) {
    room.on(RoomEvent.Disconnected, () => {
      if (this.livekitRoom !== room || this.disposed) return
      if (this.broadcastRoom && !this.isCohostMode()) return
      this.maybeReconnectViewer('connection lost')
    })
    const reconnected = (RoomEvent as any).Reconnected
    if (reconnected) {
      room.on(reconnected, () => {
        if (this.livekitRoom !== room) return
        this.viewerReconnecting = false
        this.viewerReconnectAttempts = 0
        this.viewerDisconnectStrikes = 0
        if (this.broadcastRoom && this.isCohostMode()) {
          this.syncExistingCohostVideos()
          this.syncExistingCohostAudio()
          this.updateCohostComposite()
        } else {
          this.tryAttachExistingStream()
          if (!this.hasActiveVideo) this.scheduleStreamAttachRetry()
          this.refreshParcelMirrors()
        }
      })
    }
  }

  maybeReconnectViewer(_reason: string) {
    if (this.viewerReconnecting || this.viewerConnecting || this.disposed) return
    if (this.broadcastRoom && !this.isCohostMode()) return
    if (livekitRoomState(this.livekitRoom) === 'reconnecting') return
    // no strike threshold here: unlike the broadcast side there is no health poll re-calling
    // this, and RoomEvent.Disconnected only fires once - waiting for a second strike that
    // never comes left mirrors and co-host monitors dead until reload.
    this.viewerDisconnectStrikes++
    void this.tryViewerReconnect(_reason)
  }

  async tryViewerReconnect(_reason: string) {
    if (this.viewerReconnecting || this.viewerConnecting || this.disposed) return
    if (this.broadcastRoom && !this.isCohostMode()) return
    if (this.viewerReconnectAttempts >= BROADCAST_RECONNECT_MAX) {
      this.viewerReconnectAttempts = 0
      this.viewerDisconnectStrikes = 0
      this.livekitRoom?.disconnect()
      this.livekitRoom = null
      this.scheduleViewerRetry()
      return
    }
    this.viewerReconnectAttempts++
    this.viewerReconnecting = true
    await new Promise((r) => setTimeout(r, 500 * this.viewerReconnectAttempts))
    if (this.disposed) {
      this.viewerReconnecting = false
      return
    }
    if (livekitRoomState(this.livekitRoom) === 'reconnecting') {
      this.viewerReconnecting = false
      return
    }
    this.viewerConnectGen++
    this.livekitRoom?.disconnect()
    this.livekitRoom = null
    this.viewerReconnecting = false
    await this.connectViewer()
    if (this.livekitRoom) {
      this.viewerReconnectAttempts = 0
      this.viewerDisconnectStrikes = 0
    }
  }

  onlineReconnectHandler = () => {
    if (this.disposed) return
    if (this.broadcastRoom && livekitRoomState(this.broadcastRoom) === 'disconnected') {
      this.maybeReconnectAfterDisconnect('back online')
    }
    if (this.livekitRoom && livekitRoomState(this.livekitRoom) === 'disconnected') {
      this.maybeReconnectViewer('back online')
    } else if (!this.livekitRoom && this.needsViewerRoom()) {
      void this.connectViewer()
    }
  }

  wireOnlineReconnect() {
    if (this.onlineReconnectWired) return
    this.onlineReconnectWired = true
    window.addEventListener('online', this.onlineReconnectHandler)
  }

  noteCameraHealthy(room: Room) {
    this.cameraHealthStrikes = 0
    const pub = publishedVideoTrack(room)
    if (pub) this.broadcastLiveVideoTrack = pub
    if (this.broadcastCameraLost) this.clearCameraDisconnectedUi()
  }

  noteCameraUnhealthy() {
    this.cameraHealthStrikes++
    if (this.cameraHealthStrikes >= BROADCAST_CAMERA_STRIKES) this.onCameraDisconnected()
  }

  scheduleCameraEndedCheck() {
    if (this.cameraEndedTimer) clearTimeout(this.cameraEndedTimer)
    this.cameraEndedTimer = setTimeout(() => {
      this.cameraEndedTimer = null
      if (!this.broadcastRoom || this.broadcastStopping) return
      if (broadcastVideoTrackLive(this.broadcastRoom, this.broadcastLiveVideoTrack)) {
        this.noteCameraHealthy(this.broadcastRoom)
        return
      }
      this.noteCameraUnhealthy()
    }, BROADCAST_CAMERA_ENDED_DELAY_MS)
  }

  wireCameraEndedListener(track: any) {
    const mst = track?.mediaStreamTrack as MediaStreamTrack | undefined
    if (!mst) return
    mst.addEventListener('ended', () => {
      if (!this.broadcastRoom) return
      if (this.liveStartedAt && Date.now() - this.liveStartedAt < BROADCAST_LIVE_GRACE_MS) return
      this.scheduleCameraEndedCheck()
    })
  }

  onCameraDisconnected() {
    if (this.broadcastLost || this.broadcastCameraLost || !this.broadcastRoom) return
    this.broadcastCameraLost = true
    if (this.broadcastDockStatusEl) {
      this.broadcastDockStatusEl.style.display = 'block'
      this.broadcastDockStatusEl.textContent = 'camera disconnected'
      this.broadcastDockStatusEl.style.color = '#f5b942'
    }
    if (this.broadcastCameraReconnectBtn) this.broadcastCameraReconnectBtn.style.display = 'block'
  }

  clearCameraDisconnectedUi() {
    this.broadcastCameraLost = false
    if (this.broadcastCameraReconnectBtn) this.broadcastCameraReconnectBtn.style.display = 'none'
    if (this.broadcastDockStatusEl && !this.broadcastLost) {
      this.broadcastDockStatusEl.style.display = 'none'
      this.broadcastDockStatusEl.textContent = ''
    }
  }

  async tryResumeCamera() {
    if (!this.broadcastRoom || this.broadcastLost || this.broadcastStopping) return
    if (broadcastVideoTrackLive(this.broadcastRoom, this.broadcastLiveVideoTrack)) {
      this.noteCameraHealthy(this.broadcastRoom)
      return
    }
    if (!this.broadcastCameraLost) return
    const gen = ++this.cameraResumeGen
    if (this.broadcastDockStatusEl) {
      this.broadcastDockStatusEl.style.display = 'block'
      this.broadcastDockStatusEl.textContent = 'reconnecting camera...'
      this.broadcastDockStatusEl.style.color = '#f5b942'
    }
    const room = this.broadcastRoom
    const lp = room.localParticipant
    let vt = this.broadcastLiveVideoTrack
    try {
      const mst = vt?.mediaStreamTrack as MediaStreamTrack | undefined
      const dead = !mst || mst.readyState === 'ended'
      if (!dead && vt?.restartTrack) {
        if (mobile) await vt.restartTrack(mobileConstraints(this.mobileFlipFacing, 'portrait'))
        else await vt.restartTrack({})
        if (gen !== this.cameraResumeGen || this.broadcastStopping || !this.broadcastRoom) return
      } else {
        const tracks = await createLocalTracks({
          video: cameraConstraints(undefined, mobile, 'portrait'),
          audio: false,
        })
        const newVt = tracks.find((t) => t.kind === Track.Kind.Video)
        if (!newVt) throw new Error('no camera')
        if (gen !== this.cameraResumeGen || this.broadcastStopping || !this.broadcastRoom) return
        if (vt) {
          try {
            await lp.unpublishTrack(vt, true)
          } catch {}
          try {
            vt.stop()
          } catch {}
        }
        await lp.publishTrack(newVt)
        vt = newVt
        const rest = (this.broadcastLiveTracks ?? []).filter((t) => t.kind !== Track.Kind.Video)
        this.broadcastLiveTracks = [...rest, newVt]
      }
      this.broadcastLiveVideoTrack = vt
      this.wireCameraEndedListener(vt)
      this.clearCameraDisconnectedUi()
      if (this.isCohostMode()) {
        const el = vt.attach() as HTMLVideoElement
        this.wireLocalCohostVideo(el)
        this.updateCohostComposite()
      } else {
        const el = vt.attach() as HTMLVideoElement
        el.muted = true
        el.playsInline = true
        el.setAttribute('playsinline', '')
        this.localBroadcastVideoEl = el
        this.attachVideoToMesh(el, true)
        syncVideoElFromTrack(this.mobilePreviewVideoEl, vt)
        this.mobilePreviewVideoEl?.play().catch(() => {})
        this.syncMobilePreviewDock?.()
      }
      this.parcel.getFeaturesByType('showbox').forEach((f) => (f as any).refreshMirrorVideo?.())
    } catch {
      if (gen !== this.cameraResumeGen || this.broadcastStopping) return
      this.broadcastCameraLost = false
      this.onBroadcastLost('camera reconnect failed')
    }
  }

  onBroadcastLost(reason: string) {
    if (this.broadcastLost) return
    this.broadcastReconnecting = false
    this.broadcastDisconnectStrikes = 0
    this.broadcastCameraLost = false
    this.broadcastLost = true
    app.showSnackbar('stream ended - ' + reason, PanelType.Warning)
    if (this.broadcastDockLiveLabel) {
      this.broadcastDockLiveLabel.textContent = 'offline'
      const header = this.broadcastDockLiveLabel.parentElement as HTMLElement | null
      if (header) header.style.color = '#888'
    }
    if (this.broadcastDockLiveDot) {
      this.broadcastDockLiveDot.style.animation = 'none'
      this.broadcastDockLiveDot.style.color = '#888'
    }
    if (this.broadcastDockStatusEl) {
      this.broadcastDockStatusEl.style.display = 'block'
      this.broadcastDockStatusEl.textContent = reason
      this.broadcastDockStatusEl.style.color = '#f5b942'
    }
    this.mobileBroadcastHooksClear?.()
    this.mobileBroadcastHooksClear = null
    this.broadcastStopping = true
    this.cameraResumeGen++
    this.stopBroadcast(true)
    this.dismissBroadcastPanel()
    this.clearBroadcastDockUi()
    this.setPreview()
  }

  canOpenBroadcastPanel() {
    if (this.isMirror()) return false
    return isGuestForShowbox(this.uuid) || this.parcel.canEdit
  }

  parcelEditorWallet(wallet: string) {
    const w = (wallet || '').toLowerCase().trim()
    if (!w || w.startsWith('anon-')) return false
    const editors = [...this.parcel.contributors, ...this.parcel.owners].map((x) => (x || '').toLowerCase().trim()).filter(Boolean)
    return editors.includes(w)
  }

  isGuestPublisherIdentity(identity: string) {
    const prefix = cohostIdentityPrefix(identity)
    if (prefix.startsWith('guest-')) return true
    // signed-in guest cohosts publish under their wallet - only parcel editors are hosts
    return !this.parcelEditorWallet(prefix)
  }

  get mirrorSource(): MirrorSource {
    const s = this.description.mirrorSource
    return s === 'host' || s === 'collaborator' || s === 'guest' ? s : 'auto'
  }

  // classify a publisher by parcel role (anon guests use guest- livekit identity; signed-in guests use wallet)
  publisherRole(identity: string): MirrorRole {
    if (this.isGuestPublisherIdentity(identity)) return 'guest'
    const wallet = cohostIdentityPrefix(identity).toLowerCase()
    const owners = this.parcel.owners.map((w) => (w || '').toLowerCase())
    return owners.includes(wallet) ? 'host' : 'collaborator'
  }

  shouldPlayCohostAudio(participantIdentity: string) {
    if (!this.isCohostMode() || !this.broadcastRoom || !this.livekitRoom) return false
    const theirs = cohostIdentityPrefix(participantIdentity)
    const myPub = cohostIdentityPrefix(this.broadcastRoom.localParticipant.identity)
    const mySub = cohostIdentityPrefix(this.livekitRoom.localParticipant.identity)
    // every other publisher on the stage gets a monitor. camp gating (editors hear guests,
    // guests hear editors) left host<->collaborator and guest<->guest pairs mutually silent.
    return theirs !== myPub && theirs !== mySub
  }

  trackCohostMonitor(el: HTMLAudioElement, identity?: string) {
    if (identity) {
      const prefix = cohostIdentityPrefix(identity)
      for (let i = this.cohostMonitorEls.length - 1; i >= 0; i--) {
        const old = this.cohostMonitorEls[i] as HTMLAudioElement & { dataset: { cohostPrefix?: string } }
        if (old.dataset?.cohostPrefix === prefix) {
          this.silenceAudioEl(old)
          this.cohostMonitorEls.splice(i, 1)
        }
      }
      el.dataset.cohostPrefix = prefix
    }
    el.volume = this.effectiveStreamVolume()
    el.style.display = 'none'
    document.body.appendChild(el)
    this.cohostMonitorEls.push(el)
    // going live tears down the viewer volume poll - restart it so monitors track parcel/showbox volume.
    if (!this.streamVolumeInterval) {
      this.streamVolumeInterval = setInterval(() => this.refreshStreamVolume(), VOLUME_REFRESH_INTERVAL)
    }
  }

  clearCohostMonitor() {
    for (const el of this.cohostMonitorEls) {
      this.silenceAudioEl(el)
    }
    this.cohostMonitorEls = []
  }

  stopCohostComposite() {
    if (this.cohostCompositeRetryRaf) {
      cancelAnimationFrame(this.cohostCompositeRetryRaf)
      this.cohostCompositeRetryRaf = null
    }
    if (this.cohostCompositeRaf) {
      cancelAnimationFrame(this.cohostCompositeRaf)
      this.cohostCompositeRaf = null
    }
    for (const p of this.cohostPanes) p.el.remove()
    this.cohostPanes = []
    this.cohostCompositeEl?.remove()
    this.cohostCompositeEl = null
    this.cohostCanvas = null
    this.cohostCompositeAttached = false
    this.syncCohostPreview = null
    this.clearCohostMonitor()
  }

  cohostPaneFor(key: string) {
    return this.cohostPanes.find((p) => p.key === key)
  }

  setCohostPane(key: string, el: HTMLVideoElement, editor: boolean) {
    const existing = this.cohostPaneFor(key)
    if (existing) {
      if (existing.el !== el) {
        existing.el.remove()
        existing.el = el
        existing.hadFrame = false
      }
      existing.editor = editor
      return
    }
    // stage is full - everyone is still heard, but the screen caps at host + 4
    if (this.cohostPanes.length >= MAX_COHOST_PANES) {
      el.remove()
      return
    }
    this.cohostPanes.push({ key, el, hadFrame: false, editor })
  }

  drawCohostFrame() {
    if (!this.cohostCanvas) return false
    // mobile hidden videos flicker videoWidth - once a pane had frames it keeps its spot
    for (const p of this.cohostPanes) {
      if (!cohostVideoTrackLive(p.el)) p.hadFrame = false
      else if (cohostVideoReady(p.el)) p.hadFrame = true
    }
    const visible = this.cohostPanes.filter((p) => p.hadFrame)
    if (!visible.length) return false

    // host-anchored: the first editor with video is the big pane, guests fill the rest
    const anchor = visible.find((p) => p.editor) ?? visible[0]
    const ordered = [anchor, ...visible.filter((p) => p !== anchor)]

    const canvas = this.cohostCanvas
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const rects = cohostPaneRects(ordered.length, canvas.width, canvas.height, this.isPortraitScreen())
    ordered.forEach((p, i) => {
      const r = rects[i]
      if (r && p.el.videoWidth > 0) drawVideoCover(ctx, p.el, r.x, r.y, r.w, r.h)
    })
    return true
  }

  mountCohostPreviewVideo(objectFit: string) {
    const v = document.createElement('video')
    v.muted = true
    v.volume = 0
    v.playsInline = true
    v.autoplay = true
    Object.assign(v.style, { width: '100%', height: '100%', objectFit, display: 'block' })
    this.syncCohostPreview = () => {
      const src = this.cohostCompositeEl?.srcObject
      if (!src || v.srcObject === src) return
      v.srcObject = src
      v.play().catch(() => {})
    }
    this.syncCohostPreview()
    return v
  }

  wireLocalCohostVideo(el: HTMLVideoElement) {
    el.muted = true
    el.playsInline = true
    el.autoplay = true
    el.style.display = 'none'
    document.body.appendChild(el)
    el.play().catch(() => {})
    el.addEventListener('loadeddata', () => this.updateCohostComposite(), { once: true })
    this.setCohostPane('local', el, !isGuestForShowbox(this.uuid))
  }

  syncBroadcastVideoFromTrack(track: any) {
    if (!track) return
    if (this.isCohostMode()) {
      const el = this.cohostPaneFor('local')?.el ?? null
      syncVideoElFromTrack(el, track)
      el?.addEventListener('loadeddata', () => this.updateCohostComposite(), { once: true })
      this.updateCohostComposite()
      this.syncCohostPreview?.()
      return
    }
    syncVideoElFromTrack(this.localBroadcastVideoEl, track)
    syncVideoElFromTrack(this.mobilePreviewVideoEl, track)
    this.syncMobilePreviewDock?.()
  }

  syncExistingCohostVideos() {
    if (!this.isCohostMode() || !this.livekitRoom) return
    for (const p of (this.livekitRoom as any).participants?.values() ?? []) {
      for (const pub of p.videoTracks?.values() ?? []) {
        if (this.isAngleTrackName(pub.trackName)) continue // angle feeds are not cohost composite sources
        if (pub.isSubscribed && pub.track) this.routeCohostVideo(pub.track, p.identity)
      }
    }
  }

  syncExistingCohostAudio() {
    if (!this.isCohostMode() || !this.livekitRoom || !this.broadcastRoom) return
    // Re-attaching the same track makes a second <audio> element (= double audio). Clear first so
    // this is safe to call from the subscribe handler, the viewer-connect finally, and go-live.
    this.clearCohostMonitor()
    for (const p of (this.livekitRoom as any).participants?.values() ?? []) {
      if (!this.shouldPlayCohostAudio(p.identity)) continue
      for (const pub of p.audioTracks?.values() ?? []) {
        if (pub.isSubscribed && pub.track) this.trackCohostMonitor(pub.track.attach() as HTMLAudioElement, p.identity)
      }
    }
    this.startBroadcastAudio()
  }

  updateCohostComposite() {
    if (!this.isCohostMode() || this.disposed) return

    // A guest who just went live is waiting on the host's video. Show a connecting card instead of
    // a half-empty composite, but only briefly - after the grace window we show whatever we have.
    const waitingForHost =
      !!this.broadcastRoom && !this.cohostCompositeAttached && isGuestForShowbox(this.uuid) && !this.cohostPanes.some((p) => p.editor && cohostVideoReady(p.el)) && Date.now() - this.cohostLiveSince < COHOST_CONNECT_GRACE_MS
    if (waitingForHost) {
      this.setCohostConnecting()
      return
    }

    if (!this.cohostCanvas) this.cohostCanvas = document.createElement('canvas')
    const { w: cw, h: ch } = this.meshVideoSize()
    if (this.cohostCanvas.width !== cw || this.cohostCanvas.height !== ch) {
      this.cohostCanvas.width = cw
      this.cohostCanvas.height = ch
      this.cohostCompositeAttached = false
    }

    if (!this.drawCohostFrame()) {
      this.hasActiveVideo = false
      this.syncCohostPreview?.()
      if (!this.cohostCompositeRetryRaf) {
        this.cohostCompositeRetryRaf = requestAnimationFrame(() => {
          this.cohostCompositeRetryRaf = null
          this.updateCohostComposite()
        })
      }
      return
    }
    if (this.cohostCompositeRetryRaf) {
      cancelAnimationFrame(this.cohostCompositeRetryRaf)
      this.cohostCompositeRetryRaf = null
    }

    if (!this.cohostCompositeEl) {
      const stream = this.cohostCanvas.captureStream(30)
      this.cohostCompositeEl = document.createElement('video')
      this.cohostCompositeEl.srcObject = stream
      this.cohostCompositeEl.muted = true
      this.cohostCompositeEl.playsInline = true
      this.cohostCompositeEl.autoplay = true
      this.cohostCompositeEl.play().catch(() => {})
    }

    // don't claim the composite is on the mesh while a standby card is suppressing the attach - the
    // flags would lie and a viewer who joined during the card (cold-open) would never re-pin the
    // composite when the card clears. stays false now; reconcile re-runs this once intermission ends.
    if (!this.cohostCompositeAttached && !this.isIntermissionActive()) {
      this.attachVideoToMesh(this.cohostCompositeEl, true)
      this.cohostCompositeAttached = true
      this.hasActiveVideo = true
    }

    if (!this.cohostCompositeRaf) {
      const tick = () => {
        if (!this.cohostCanvas || this.disposed) {
          this.cohostCompositeRaf = null
          return
        }
        if (!this.drawCohostFrame()) {
          this.cohostCompositeRaf = null
          this.hasActiveVideo = false
          if (!this.cohostCompositeRetryRaf) {
            this.cohostCompositeRetryRaf = requestAnimationFrame(() => {
              this.cohostCompositeRetryRaf = null
              this.updateCohostComposite()
            })
          }
          return
        }
        this.cohostCompositeRaf = requestAnimationFrame(tick)
      }
      this.cohostCompositeRaf = requestAnimationFrame(tick)
    }
    this.syncCohostPreview?.()
  }

  routeCohostVideo(track: any, identity: string) {
    const key = cohostIdentityPrefix(identity)
    // our own published video echoes back through the viewer room - the 'local' pane already has us
    const myPub = this.broadcastRoom ? cohostIdentityPrefix((this.broadcastRoom as any).localParticipant.identity) : null
    if (myPub && key === myPub) return
    const mst = track?.mediaStreamTrack as MediaStreamTrack | undefined
    const existing = this.cohostPaneFor(key)
    if (existing && mst) {
      const cur = existing.el.srcObject instanceof MediaStream ? existing.el.srcObject.getVideoTracks()[0] : null
      if (cur === mst) return
    }
    const el = track.attach() as HTMLVideoElement
    el.muted = true
    el.playsInline = true
    el.autoplay = true
    el.style.display = 'none'
    document.body.appendChild(el)
    el.play().catch(() => {})
    el.addEventListener('loadeddata', () => this.updateCohostComposite(), { once: true })
    this.setCohostPane(key, el, !this.isGuestPublisherIdentity(identity))
    this.updateCohostComposite()
  }

  clearCohostVideoForIdentity(identity: string) {
    const key = cohostIdentityPrefix(identity)
    const i = this.cohostPanes.findIndex((p) => p.key === key)
    if (i < 0) return
    this.cohostPanes[i].el.remove()
    this.cohostPanes.splice(i, 1)
  }

  shouldBeInteractive(): boolean {
    return true
  }

  whatIsThis() {
    return <label>Live stream video and audio to anyone in the parcel.</label>
  }

  // Editing a live showbox must never tear it down. The plane mesh never needs rebuilding:
  // setCommon re-applies the transform and afterSetCommon re-applies spatial audio (volume +
  // rolloff). The base update() regenerates for non-transform props (rolloff/guestMode), which
  // disposes the feature and kills the broadcast for everyone - so skip it and just setCommon.
  update(props: Partial<any>) {
    Object.assign(this.description, props)
    this.setCommon()
    if (this.isMirror()) {
      // toggled off angle mode while broadcasting one - drop the orphaned track
      if (this.angleVideoTrack && !this.isAngleMirror()) this.stopAngleBroadcast()
      this.refreshMirrorVideo()
    }
    if (!this.hasActiveVideo && !this.broadcastRoom) this.setPreview()
  }

  generate() {
    this.mesh = BABYLON.MeshBuilder.CreatePlane(this.uniqueEntityName('mesh'), { size: 1 }, this.scene)
    this.mesh.id = this.mesh.name + '/' + this.uuid
    this.setCommon()
    this.afterSetCommon = () => {
      for (const spatial of this.streamSpatialByEl.values()) {
        spatial.setPosition(this.absolutePosition)
        spatial.volume = this.volume
        spatial.rolloffFactor = this.rolloffFactor
      }
    }
    this.addEvents()
    this.setPreview()
    if (this.isInCurrentParcel) {
      this.onEnter()
    }
    if (process.env.NODE_ENV !== 'production') {
      try {
        const q = new URLSearchParams(location.search)
        if (q.get('debugShowboxDock') === this.uuid) {
          setTimeout(() => this.openBroadcastPanel(), 5000)
        }
      } catch {}
    }
    return Promise.resolve()
  }

  onEnter = () => {
    this.wireOnlineReconnect()
    if (isSyntheticGuestWallet()) consumeGuestFreshFromUrl((n) => app.setName(n))
    if (guestJwtPayload()?.guest_pass) {
      void maybeRefreshGuestJwt()
      if (!this.guestJwtRefreshInterval) {
        this.guestJwtRefreshInterval = setInterval(() => void maybeRefreshGuestJwt(), 5 * 60 * 1000)
      }
    }
    if (!this.livekitRoom && this.needsViewerRoom()) {
      this.connectViewer()
    }
    // Guest pass redirects with ?show=<uuid> - auto-open the broadcast dock so they don't have to find/click the panel.
    // Host links (?host=1) need a signed-in parcel owner - prompt login first if needed.
    // Wallet may still be loading from the jwt cookie when onEnter fires; retry after app state settles.
    if (this.broadcastPanel) return
    const hostOrGuest = wantsHostJoin(this.uuid) || isGuestForShowbox(this.uuid)
    if (hostOrGuest && this.hostJoinAutoOpenStarted) return
    if (hostOrGuest) this.hostJoinAutoOpenStarted = true

    const tryAutoOpen = () => {
      if (this.broadcastPanel || this.joinDockAutoOpened) return true
      if (isGuestForShowbox(this.uuid)) {
        this.joinDockAutoOpened = true
        clearShowboxJoinParams()
        this.openBroadcastPanel(true)
        if (!this.broadcastPanel) {
          this.joinDockAutoOpened = false
          return false
        }
        this.hostDockAutoOpenedAt = Date.now()
        return true
      }
      if (wantsHostJoin(this.uuid)) {
        if (!app.signedIn) return false
        if (!this.parcel.canEdit) {
          app.showSnackbar('sign in as the parcel owner to use this host link', PanelType.Warning)
          return false
        }
        let opener: Showbox = this
        if (this.isMirror()) {
          const primary = this.parcel.primaryShowbox() as Showbox | undefined
          if (primary?.uuid && primary.uuid !== this.uuid) opener = primary
        }
        if (opener.broadcastPanel || opener.joinDockAutoOpened) return true
        opener.joinDockAutoOpened = true
        clearShowboxJoinParams()
        opener.openBroadcastPanel(true)
        if (!opener.broadcastPanel) {
          opener.joinDockAutoOpened = false
          return false
        }
        opener.hostDockAutoOpenedAt = Date.now()
        this.joinDockAutoOpened = true
        return true
      }
      return false
    }
    if (!hostOrGuest) return

    setTimeout(() => {
      if (tryAutoOpen()) return
      void app.getState().then(() => {
        if (tryAutoOpen()) return
        if (!this.broadcastRoom && !this.hasActiveVideo) this.setPreview()
      })
      if (!wantsHostJoin(this.uuid) && !isGuestForShowbox(this.uuid)) return
      const stopAt = Date.now() + 15000
      const onWalletReady = () => {
        if (Date.now() > stopAt || this.disposed || this.broadcastPanel || this.joinDockAutoOpened) {
          app.removeListener(AppEvent.Change, onWalletReady)
          return
        }
        if (!wantsHostJoin(this.uuid) && !isGuestForShowbox(this.uuid)) {
          app.removeListener(AppEvent.Change, onWalletReady)
          return
        }
        if (tryAutoOpen()) app.removeListener(AppEvent.Change, onWalletReady)
      }
      app.on(AppEvent.Change, onWalletReady)
      setTimeout(() => app.removeListener(AppEvent.Change, onWalletReady), 15000)
      setTimeout(() => {
        if (this.disposed || this.broadcastPanel || this.joinDockAutoOpened || !wantsHostJoin(this.uuid) || app.signedIn) return
        this.promptHostSignIn()
      }, 3000)
    }, 250)
  }

  promptHostSignIn() {
    if (this.hostJoinLoginPending || this.broadcastPanel) return
    this.hostJoinLoginPending = true
    window.ui?.setPane('login')
    app.showSnackbar('sign in to go live as host', PanelType.Success)
    app.once(AppEvent.Login, () => {
      this.hostJoinLoginPending = false
      setTimeout(() => {
        if (this.disposed || !this.isInCurrentParcel || this.broadcastPanel) return
        if (!wantsHostJoin(this.uuid)) return
        if (!app.signedIn) return
        if (!this.parcel.canEdit) {
          app.showSnackbar('this account cannot host here - use the parcel owner account', PanelType.Warning)
          return
        }
        let opener: Showbox = this
        if (this.isMirror()) {
          const primary = this.parcel.primaryShowbox() as Showbox | undefined
          if (primary?.uuid && primary.uuid !== this.uuid) opener = primary
        }
        if (opener.broadcastPanel) return
        opener.joinDockAutoOpened = true
        clearShowboxJoinParams()
        opener.openBroadcastPanel(true)
        if (!opener.broadcastPanel) {
          opener.joinDockAutoOpened = false
          return
        }
        opener.hostDockAutoOpenedAt = Date.now()
        this.joinDockAutoOpened = true
      }, 500)
    })
  }

  onExit = () => {
    this.stopViewerRetry()
    this.stopStreamAttachRetry()
    this.viewerRoomFull = false
    // if we're on the stage (publishing), stay connected as a viewer too so our own composite
    // doesn't go blank when we step outside the parcel. we only tear down on dispose / stopBroadcast.
    if (this.livekitRoom && !this.broadcastRoom) {
      // the angle feed publishes on the viewer room - disconnecting silently kills it, so tear
      // it down properly or hasAngleFeed()/startAngleBroadcast() get stuck on a dead track
      if (this.angleVideoTrack) this.stopAngleBroadcast(true)
      this.livekitRoom.disconnect()
      this.livekitRoom = null
      this.hasActiveVideo = false
      this.stopStreamVolumePoll()
      unduckRadio(this)
    }
  }

  stopViewerRetry() {
    if (this.viewerRetryInterval) {
      clearInterval(this.viewerRetryInterval)
      this.viewerRetryInterval = null
    }
  }

  scheduleViewerRetry() {
    if (this.viewerRetryInterval || this.disposed) return
    this.viewerRetryInterval = setInterval(() => {
      if (this.disposed || this.viewerConnecting) return
      if (this.broadcastRoom && !this.isCohostMode()) return
      if (this.livekitRoom) return
      if (!this.isInCurrentParcel && !this.viewerRoomFull && !this.broadcastRoom) return
      this.connectViewer()
    }, VIEWER_RETRY_INTERVAL)
  }

  stopStreamAttachRetry() {
    if (this.streamAttachRetryInterval) {
      clearInterval(this.streamAttachRetryInterval)
      this.streamAttachRetryInterval = null
    }
    this.streamAttachAttempts = 0
  }

  scheduleStreamAttachRetry() {
    if (this.streamAttachRetryInterval || this.disposed || this.broadcastRoom) return
    if (!this.displaysStream()) return
    this.streamAttachAttempts = 0
    this.streamAttachRetryInterval = setInterval(() => {
      if (this.disposed || !this.isInCurrentParcel || this.broadcastRoom) {
        this.stopStreamAttachRetry()
        return
      }
      if (!this.displaysStream()) {
        this.stopStreamAttachRetry()
        return
      }
      if (this.hasActiveVideo) {
        this.stopStreamAttachRetry()
        return
      }
      this.tryAttachExistingStream()
      if (this.hasActiveVideo) {
        this.stopStreamAttachRetry()
        return
      }
      this.streamAttachAttempts++
      if (this.streamAttachAttempts >= STREAM_ATTACH_RECONNECT_AFTER && this.livekitRoom && !this.viewerConnecting) {
        // nuking the viewer room mid-feed just unsubscribes and replays the flash loop
        if (this.isMirror()) {
          this.streamAttachAttempts = 0
          return
        }
        this.viewerConnectGen++
        this.livekitRoom.disconnect()
        this.livekitRoom = null
        this.stopStreamAttachRetry()
        this.connectViewer()
      }
    }, STREAM_ATTACH_RETRY_MS)
  }

  dispose() {
    this._dispose()
    window.removeEventListener('online', this.onlineReconnectHandler)
    this.onlineReconnectWired = false
    if (this.mirrorRefreshTimer) clearTimeout(this.mirrorRefreshTimer)
    this.mirrorRefreshTimer = null
    if (this.guestJwtRefreshInterval) clearInterval(this.guestJwtRefreshInterval)
    this.guestJwtRefreshInterval = null
    this.stopMilestonePoll()
    this.stopViewerRetry()
    this.stopStreamAttachRetry()
    this.viewerRoomFull = false
    this.closeAnglePanel()
    this.stopIntermissionCard()
    if (this.intermissionStatusInterval) {
      clearInterval(this.intermissionStatusInterval)
      this.intermissionStatusInterval = null
    }
    this.stopMeshLetterbox()
    this.screenMaterial?.dispose(true, true)
    this.screenMaterial = null
    this.stopAngleBroadcast(true)
    this.livekitRoom?.disconnect()
    this.livekitRoom = null
    this.stopStreamVolumePoll()
    this.stopCohostComposite()
    this.stopBroadcast(true)
    this.dismissBroadcastPanel()
    this.clearBroadcastDockUi()
    this.hostJoinLoginPending = false
    unduckRadio(this)
  }

  // a plain mirror shows whatever the primary showbox is showing, so it reflects the primary's
  // intermission. the primary (and angle mirrors) use their own flag.
  effectiveIntermission(): ShowboxIntermission | null {
    if (this.isMirror() && !this.isAngleMirror()) {
      return (this.parcel.primaryShowbox() as Showbox | undefined)?.intermission ?? null
    }
    return this.intermission
  }

  isIntermissionActive() {
    return !!this.effectiveIntermission()
  }

  // mm:ss until `until`, or '' when there's no countdown. holds at "starting now" past zero - the
  // host flips back manually, we never auto-reveal onto an empty chair.
  intermissionCountdownLabel(until: number | null) {
    if (!until) return ''
    const ms = until - Date.now()
    if (ms <= 0) return 'starting now'
    const total = Math.ceil(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // broadcaster raises the screen: mute the mic, broadcast the flag, draw the card. the camera keeps
  // running underneath (the card material just covers it) - muting the livekit camera track ends the
  // MediaStreamTrack and trips the "camera lost" health teardown, so we don't.
  raiseIntermission(label: string, untilMs: number | null) {
    if (!this.broadcastRoom) return
    const at = Date.now()
    this.intermission = { label, until: untilMs, at }
    try {
      this.intermissionPrevMic = !!this.broadcastRoom.localParticipant.isMicrophoneEnabled
    } catch {
      this.intermissionPrevMic = false
    }
    try {
      void this.broadcastRoom.localParticipant.setMicrophoneEnabled(false)
    } catch {}
    try {
      this.parcel.sendStatePatch({ [this.uuid]: { intermission: { label, until: untilMs, at } } })
    } catch {}
    this.drawIntermissionCard()
    this.refreshParcelMirrors()
  }

  // broadcaster drops the screen: clear the flag, restore the mic to whatever it was, let the normal
  // reconcile repaint the live feed (the camera never stopped, so it comes back instantly).
  dropIntermission() {
    if (!this.intermission) return
    this.intermission = null
    this.stopIntermissionCard()
    if (this.intermissionStatusInterval) {
      clearInterval(this.intermissionStatusInterval)
      this.intermissionStatusInterval = null
    }
    try {
      void this.broadcastRoom?.localParticipant.setMicrophoneEnabled(this.intermissionPrevMic)
    } catch {}
    try {
      this.parcel.sendStatePatch({ [this.uuid]: { intermission: null } })
    } catch {}
    this.hasActiveVideo = false
    if (this.broadcastRoom && this.isCohostMode()) {
      // cohost shows (the default) render a composite, not a single element - force it back onto the mesh
      this.cohostCompositeAttached = false
      this.updateCohostComposite()
    } else if (this.broadcastRoom && this.localBroadcastVideoEl) {
      this.attachVideoToMesh(this.localBroadcastVideoEl, true)
    } else {
      this.setPreview()
    }
    this.refreshParcelMirrors()
  }

  stopIntermissionCard() {
    if (this.intermissionRaf) {
      cancelAnimationFrame(this.intermissionRaf)
      this.intermissionRaf = null
    }
    this.intermissionCanvas = null
  }

  // the animated standby card. the motion (sweep bar + pulsing dots) is the whole point: it proves the
  // stream is alive even though the camera is hidden. one raf reads the live flag/clock each frame, so
  // repeated calls are a no-op rather than a rebuild/flicker.
  drawIntermissionCard() {
    if (this.disposed || !this.mesh) return
    if (!this.effectiveIntermission()) return
    if (this.intermissionRaf) return
    this.stopMeshLetterbox()
    this.hasActiveVideo = false
    const { w, h } = this.meshVideoSize()
    if (!this.intermissionCanvas) this.intermissionCanvas = document.createElement('canvas')
    const canvas = this.intermissionCanvas
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const tex = new BABYLON.DynamicTexture(this.uniqueEntityName('texture'), canvas, this.scene, false)
    tex.hasAlpha = false
    const material = new BABYLON.StandardMaterial(this.uniqueEntityName('material'), this.scene)
    material.diffuseTexture = tex
    material.backFaceCulling = false
    material.zOffset = -5
    material.specularColor.set(0, 0, 0)
    material.emissiveColor.set(1, 1, 1)
    material.blockDirtyMechanism = true
    this.swapScreenMaterial(material)
    let frame = 0
    const tick = () => {
      if (this.disposed || !this.mesh) {
        this.stopIntermissionCard()
        return
      }
      const cur = this.effectiveIntermission()
      if (!cur) {
        this.stopIntermissionCard()
        return
      }
      frame++
      ctx.fillStyle = '#0d0d0d'
      ctx.fillRect(0, 0, w, h)
      // sweep bar travelling left-to-right under the title
      const barW = w * 0.5
      const x = ((frame * 2) % (w + barW)) - barW
      const grad = ctx.createLinearGradient(x, 0, x + barW, 0)
      grad.addColorStop(0, 'rgba(220,30,30,0)')
      grad.addColorStop(0.5, 'rgba(220,30,30,0.55)')
      grad.addColorStop(1, 'rgba(220,30,30,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, h * 0.5 + 30, w, 4)
      // three pulsing dots
      for (let i = 0; i < 3; i++) {
        const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(frame * 0.08 - i * 0.7))
        ctx.fillStyle = `rgba(245,245,240,${a})`
        ctx.beginPath()
        ctx.arc(w / 2 - 16 + i * 16, h * 0.5 + 56, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#f5f5f0'
      ctx.font = 'bold 28px "Source Code Pro", monospace'
      ctx.fillText(cur.label || 'starting soon', w / 2, h * 0.5 - 16)
      const countdown = this.intermissionCountdownLabel(cur.until)
      if (countdown) {
        ctx.font = '20px "Source Code Pro", monospace'
        ctx.fillStyle = '#f5b942'
        ctx.fillText(countdown, w / 2, h * 0.5 + 10)
      }
      tex.update()
      this.intermissionRaf = requestAnimationFrame(tick)
    }
    tick()
  }

  // small setup dialog (modelled on the second-camera panel): pick a message + optional countdown,
  // then raise. coming back is a single tap on the dock button - no dialog.
  openIntermissionPanel(onConfirm: (label: string, untilMs: number | null) => void) {
    exitPointerLock()
    const panel = document.createElement('div')
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '999999',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: mobile ? 'calc(100vw - 2rem)' : '320px',
      background: '#0d0d0d',
      color: '#f5f5f0',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      fontFamily: '"Source Code Pro", monospace',
      fontSize: mobile ? '15px' : '13px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
    })

    const title = document.createElement('div')
    title.textContent = 'take a break'
    title.style.fontWeight = 'bold'
    title.style.fontSize = mobile ? '16px' : '14px'

    const inputStyle: Record<string, string> = { width: '100%', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: mobile ? '10px' : '6px' }
    if (mobile) Object.assign(inputStyle, { fontSize: '16px', minHeight: '44px' })

    // pre-filled with the common case; type over it for "starting soon" or anything else.
    const msgInput = document.createElement('input')
    msgInput.type = 'text'
    msgInput.value = 'be right back'
    msgInput.maxLength = 40
    Object.assign(msgInput.style, inputStyle)

    const minInput = document.createElement('input')
    minInput.type = 'number'
    minInput.min = '1'
    minInput.placeholder = 'minutes until start (optional)'
    Object.assign(minInput.style, inputStyle)

    const go = document.createElement('button')
    go.type = 'button'
    go.textContent = 'raise'
    Object.assign(go.style, { background: 'var(--red)', color: '#fff', border: '0', padding: mobile ? '12px' : '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' })
    go.onclick = () => {
      const mins = parseFloat(minInput.value)
      const untilMs = !isNaN(mins) && mins > 0 ? Date.now() + mins * 60_000 : null
      panel.remove()
      if (mobile) refreshMobileCanvasAfterReturn()
      onConfirm(msgInput.value.trim() || 'be right back', untilMs)
    }

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'cancel'
    Object.assign(cancel.style, { background: 'transparent', color: '#888', border: '0', padding: '4px 0', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' })
    cancel.onclick = () => {
      panel.remove()
      if (mobile) refreshMobileCanvasAfterReturn()
    }

    panel.append(title, msgInput, minInput, go, cancel)
    document.body.appendChild(panel)
  }

  setPreview() {
    if (this.disposed) return
    if (this.isIntermissionActive()) {
      this.drawIntermissionCard()
      return
    }
    if (this.broadcastRoom && this.localBroadcastVideoEl) {
      this.attachVideoToMesh(this.localBroadcastVideoEl, true)
      return
    }
    if (this.broadcastRoom) return
    if (this.hasActiveVideo) return
    // the stream is gone - stop the letterbox raf or it keeps uploading the dead frame forever
    this.stopMeshLetterbox()
    const { w, h } = this.meshVideoSize()
    const tex = new BABYLON.DynamicTexture(this.uniqueEntityName('texture'), { width: w, height: h }, this.scene, false)
    const ctx = tex.getContext() as CanvasRenderingContext2D
    const font = 'bold 18px "Source Code Pro", monospace'

    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, w, h)
    ctx.font = font
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f5f5f0'

    // an angle mirror never shows the primary's stream, so "connecting..." would lie - skip it and show its own cta/placeholder
    const hasRemoteBroadcaster = this.hasRemoteBroadcaster() && !this.isAngleMirror()

    if (hasRemoteBroadcaster && !(this.isCohostMode() && this.canOpenBroadcastPanel())) {
      ctx.fillStyle = '#888'
      ctx.fillText(mobile && !this.hasActiveVideo ? 'tap to listen' : 'connecting to stream...', w / 2, h / 2)
    } else if (!this.isMirror() && (this.parcel.canEdit || isGuestForShowbox(this.uuid))) {
      ctx.fillText('showbox', w / 2, h / 2 - 20)
      const cta = '\u25CF click here to go live'
      const tw = ctx.measureText(cta).width
      const padX = 14
      const padY = 10
      const bw = tw + padX * 2
      const bh = 20 + padY * 2
      ctx.fillStyle = 'rgba(220,30,30,0.85)'
      ctx.fillRect(w / 2 - bw / 2, h / 2 + 10, bw, bh)
      ctx.fillStyle = '#f5f5f0'
      ctx.fillText(cta, w / 2, h / 2 + 10 + bh / 2)
    } else if (this.viewerRoomFull) {
      ctx.fillStyle = '#f5f5f0'
      ctx.fillText('this show is full', w / 2, h / 2 - 14)
      ctx.fillStyle = '#888'
      ctx.fillText('hang tight -- retrying for a spot', w / 2, h / 2 + 14)
    } else if (mobile && this.livekitRoom && this.streamTargetsThisShowbox()) {
      ctx.fillStyle = '#888'
      ctx.fillText('connecting to stream...', w / 2, h / 2)
    } else if (this.canBroadcastAngle()) {
      ctx.fillText('second screen', w / 2, h / 2 - 20)
      const cta = '\u25CF broadcast to this mirror'
      const tw = ctx.measureText(cta).width
      const padX = 14
      const padY = 10
      const bw = tw + padX * 2
      const bh = 20 + padY * 2
      ctx.fillStyle = 'rgba(220,30,30,0.85)'
      ctx.fillRect(w / 2 - bw / 2, h / 2 + 10, bw, bh)
      ctx.fillStyle = '#f5f5f0'
      ctx.fillText(cta, w / 2, h / 2 + 10 + bh / 2)
    } else if (this.isAngleMirror()) {
      ctx.fillStyle = '#888'
      ctx.fillText('second screen', w / 2, h / 2)
    } else if (this.isMirror()) {
      ctx.fillStyle = '#888'
      ctx.fillText('showbox screen mirror', w / 2, h / 2)
    } else {
      ctx.fillStyle = '#888'
      ctx.fillText('no stream active', w / 2, h / 2)
    }

    tex.update()
    tex.hasAlpha = false

    const material = new BABYLON.StandardMaterial(this.uniqueEntityName('material'), this.scene)
    material.diffuseTexture = tex
    material.backFaceCulling = false
    material.zOffset = -5
    material.specularColor.set(0, 0, 0)
    material.emissiveColor.set(1, 1, 1)
    material.blockDirtyMechanism = true

    this.swapScreenMaterial(material)
  }

  setCohostConnecting() {
    if (this.disposed || !this.mesh) return
    const w = 640
    const h = 360
    const tex = new BABYLON.DynamicTexture(this.uniqueEntityName('texture'), { width: w, height: h }, this.scene, false)
    const ctx = tex.getContext() as CanvasRenderingContext2D
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, w, h)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.font = 'bold 18px "Source Code Pro", monospace'
    ctx.fillStyle = '#f5f5f0'
    ctx.fillText('connecting your co-host...', w / 2, h / 2 - 12)
    ctx.font = '14px "Source Code Pro", monospace'
    ctx.fillStyle = '#888'
    ctx.fillText("hang tight -- audio's on the way", w / 2, h / 2 + 16)
    tex.update()
    tex.hasAlpha = false

    const material = new BABYLON.StandardMaterial(this.uniqueEntityName('material'), this.scene)
    material.diffuseTexture = tex
    material.backFaceCulling = false
    material.zOffset = -5
    material.specularColor.set(0, 0, 0)
    material.emissiveColor.set(1, 1, 1)
    material.blockDirtyMechanism = true

    this.swapScreenMaterial(material)
  }

  connectViewer(): Promise<void> {
    // a freshly spawned mirror starts this connect in its own init, so publishAngleTrack's await
    // right after spawn used to no-op on viewerConnecting and publish into a null room - join the
    // in-flight connect instead
    if (this.viewerConnectPromise) return this.viewerConnectPromise
    const run = connectViewer.call(this).finally(() => {
      if (this.viewerConnectPromise === run) this.viewerConnectPromise = null
    })
    this.viewerConnectPromise = run
    return run
  }

  // audience audio, pinnable from the header radio
  duckLive() {
    duckRadio(this, `livekit:${this.roomName()}`, this.parcel.name || this.parcel.address || 'live show')
  }

  startBroadcastAudio() {
    if (!this.livekitRoom || !wantsAudio()) return
    this.livekitRoom.startAudio().catch(() => {})
    this.duckLive()
  }

  unblockAudiencePlayback() {
    if (this.broadcastRoom) return
    // tapping a plain mirror should unblock the show's audio - that lives on the primary's room
    if (this.isMirror() && !this.isAngleMirror()) {
      const primary = this.parcel.primaryShowbox() as Showbox | undefined
      if (primary && primary !== this) primary.unblockAudiencePlayback()
      this.refreshMirrorVideo()
      return
    }
    if (!this.livekitRoom) return
    this.startBroadcastAudio()
    this.tryAttachExistingStream()
    if (this.streamTargetsThisShowbox() && !this.hasActiveVideo) this.scheduleStreamAttachRetry()
  }

  gestureUnblockArmed = false
  armGestureUnblock() {
    if (this.gestureUnblockArmed) return
    this.gestureUnblockArmed = true
    const unblock = () => {
      this.gestureUnblockArmed = false
      this.startBroadcastAudio()
    }
    window.addEventListener('pointerdown', unblock, { once: true, passive: true })
    window.addEventListener('keydown', unblock, { once: true, passive: true })
    window.addEventListener('touchstart', unblock, { once: true, passive: true })
  }

  stopMeshLetterbox() {
    if (this.meshLetterboxRaf) {
      cancelAnimationFrame(this.meshLetterboxRaf)
      this.meshLetterboxRaf = null
    }
    this.meshLetterboxCanvas = null
  }

  // babylon does not refcount replaced materials/textures - dispose the previous screen
  // material we made (never the mesh's original one) or every preview/attach leaks GPU memory.
  screenMaterial: BABYLON.Material | null = null
  swapScreenMaterial(material: BABYLON.Material) {
    const old = this.screenMaterial
    this.screenMaterial = material
    if (this.mesh) this.mesh.material = material
    if (old && old !== material) old.dispose(true, true)
  }

  attachVideoToMesh(el: HTMLVideoElement, muted = false, retries = 0) {
    if (!this.mesh) {
      if (retries < 30) requestAnimationFrame(() => this.attachVideoToMesh(el, muted, retries + 1))
      return
    }
    // standby card outranks any live feed on the mesh - every video repaint funnels through here.
    if (this.isIntermissionActive()) {
      this.drawIntermissionCard()
      return
    }
    el.muted = muted
    el.autoplay = true
    el.play().catch(() => {})

    this.hasActiveVideo = true
    this.stopMeshLetterbox()

    const applyMaterial = (tex: BABYLON.BaseTexture) => {
      const mat = new BABYLON.StandardMaterial(this.uniqueEntityName('material'), this.scene)
      mat.diffuseTexture = tex
      mat.backFaceCulling = false
      mat.zOffset = -5
      mat.specularColor.set(0, 0, 0)
      mat.emissiveColor.set(1, 1, 1)
      mat.blockDirtyMechanism = true
      this.swapScreenMaterial(mat)
    }

    const attachDirect = () => {
      const tex = new BABYLON.VideoTexture(this.uniqueEntityName('texture'), el, this.scene, false, false)
      tex.hasAlpha = false
      applyMaterial(tex)
    }

    const attachCovered = () => {
      if (!this.meshLetterboxCanvas) this.meshLetterboxCanvas = document.createElement('canvas')
      const canvas = this.meshLetterboxCanvas
      const { w: outW, h: outH } = this.meshVideoSize()
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        attachDirect()
        return
      }
      const tex = new BABYLON.DynamicTexture(this.uniqueEntityName('texture'), canvas, this.scene, false)
      tex.hasAlpha = false
      applyMaterial(tex)
      const tick = () => {
        if (this.disposed || !this.mesh) return
        ctx.fillStyle = '#0d0d0d'
        ctx.fillRect(0, 0, outW, outH)
        if (el.videoWidth > 0 && el.videoHeight > 0) drawVideoCover(ctx, el, 0, 0, outW, outH)
        tex.update()
        this.meshLetterboxRaf = requestAnimationFrame(tick)
      }
      tick()
    }

    const pickMode = () => {
      attachCovered()
    }
    if (el.videoWidth > 0) pickMode()
    else el.addEventListener('loadedmetadata', pickMode, { once: true })
  }

  startThumbCapture(videoEl?: HTMLVideoElement) {
    if (this.thumbInterval) {
      clearInterval(this.thumbInterval)
      this.thumbInterval = null
    }
    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement('canvas')
      this.thumbCanvas.width = THUMB_W
      this.thumbCanvas.height = THUMB_H
    }
    const canvas = this.thumbCanvas
    const ctx = canvas.getContext('2d')!
    const room = this.roomName()
    const id = this.parcel.id
    const parcel = { id, name: this.parcel.name, address: this.parcel.address }
    this.thumbInterval = setInterval(() => {
      try {
        if (this.isIntermissionActive()) {
          // on a break the homepage should show the standby card, not the hidden camera
          ctx.fillStyle = '#0d0d0d'
          ctx.fillRect(0, 0, THUMB_W, THUMB_H)
          if (this.intermissionCanvas) drawVideoCover(ctx, this.intermissionCanvas, 0, 0, THUMB_W, THUMB_H)
        } else if (this.isCohostMode()) {
          if (!this.cohostCanvas) {
            this.cohostCanvas = document.createElement('canvas')
            const { w: cw, h: ch } = this.meshVideoSize()
            this.cohostCanvas.width = cw
            this.cohostCanvas.height = ch
          }
          if (!this.drawCohostFrame()) return
          ctx.fillStyle = '#0d0d0d'
          ctx.fillRect(0, 0, THUMB_W, THUMB_H)
          drawVideoCover(ctx, this.cohostCanvas, 0, 0, THUMB_W, THUMB_H)
        } else if (videoEl) {
          ctx.fillStyle = '#0d0d0d'
          ctx.fillRect(0, 0, THUMB_W, THUMB_H)
          drawVideoCover(ctx, videoEl, 0, 0, THUMB_W, THUMB_H)
        } else return
        const thumbnail = canvas.toDataURL('image/jpeg', 0.2)
        const coord = encodeCoords({ position: cameraPosition(this.scene), rotation: cameraRotation(this.scene) })
        fetch(`/api/rooms/${room}/thumbnail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: app.avatarRef, parcel, coord, thumbnail }),
        }).catch(() => {})
      } catch {}
    }, 1000)
  }

  stopThumbCapture(silent = false) {
    if (this.thumbInterval) {
      clearInterval(this.thumbInterval)
      this.thumbInterval = null
    }
    if (!silent) {
      fetch(`/api/rooms/${this.roomName()}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnail: null }),
      }).catch(() => {})
    }
  }

  announceLiveInChat() {
    if (this.liveChatAnnounced || !window.connector) return
    // someone is already broadcasting to this showbox, so the show's already been announced live.
    // without this, every cohost who goes live fires their own "is live" message (spammy).
    if (this.hasRemoteBroadcaster()) return
    const hostName = (app.state.name || '').trim()
    if (!hostName) return
    const { parcel, f } = showboxFeatureCoords(this)
    const encoded = showboxAudiencePlayCoordsFromRecord(parcel, f)
    const location = this.parcel.name || this.parcel.address || 'the world'
    window.connector.announceShowLive(hostName, location, encoded)
    this.liveChatAnnounced = true
  }

  stopBroadcast(silent = false) {
    // done broadcasting: hand the voice mic back to the avatar and bring the soundtrack back
    window.persona?.voiceChat?.setBroadcasting(false)
    setRadioBroadcasting(false)
    window._audio?.setBroadcasting(false)
    this.liveChatAnnounced = false
    this.walkAwayWarned = false
    this.stopMilestonePoll()
    const othersLive = this.hasOtherLivePublishers()
    if (this.fxAutoTimer) {
      clearTimeout(this.fxAutoTimer)
      this.fxAutoTimer = null
    }
    if (this.broadcastFxProcessor) {
      void this.broadcastFxProcessor.destroy?.()
      this.broadcastFxProcessor = null
    }
    if (this.intermission) this.intermission = null
    this.stopIntermissionCard()
    if (this.intermissionStatusInterval) {
      clearInterval(this.intermissionStatusInterval)
      this.intermissionStatusInterval = null
    }
    try {
      const patch: Record<string, any> = { [this.uuid]: { intermission: null } }
      // only a real broadcaster clears the live flag; audience teardown must not nuke it for everyone
      if (this.broadcastRoom && this.activeLiveShowboxUuid() === this.uuid && !othersLive) patch.__showbox_live = null
      this.parcel.sendStatePatch(patch)
    } catch {}
    this.stopThumbCapture(silent)
    this.clearCohostMonitor()
    this.broadcastRoom?.disconnect()
    this.broadcastRoom = null
    this.broadcastLiveTracks = null
    this.broadcastLiveVideoTrack = null
    this.broadcastLiveAudioTrack = null
    this.broadcastReconnecting = false
    this.broadcastReconnectAttempts = 0
    this.broadcastDisconnectStrikes = 0
    this.broadcastCameraLost = false
    this.cameraHealthStrikes = 0
    if (this.cameraEndedTimer) {
      clearTimeout(this.cameraEndedTimer)
      this.cameraEndedTimer = null
    }
    this.viewerReconnectAttempts = 0
    this.viewerDisconnectStrikes = 0
    this.viewerReconnecting = false
    // ending your session also drops any second-camera feeds you pushed to sibling angle mirrors
    for (const b of this.parcel.getFeaturesByType('showbox') as any[]) {
      if (b?.angleVideoTrack) b.stopAngleBroadcast()
    }
    this.localBroadcastVideoEl = null
    this.hasActiveVideo = false
    this.cohostCompositeAttached = false
    this.syncCohostPreview = null
    unduckRadio(this)
    if (this.liveTimerInterval) {
      clearInterval(this.liveTimerInterval)
      this.liveTimerInterval = null
    }
    this.liveStartedAt = null
    broadcastLiveStartedAt.value = undefined
    if (this.audioMeterRaf) {
      cancelAnimationFrame(this.audioMeterRaf)
      this.audioMeterRaf = null
    }
    if (this.audioMeterCtx) {
      this.audioMeterCtx.close().catch(() => {})
      this.audioMeterCtx = null
    }
    if (this.broadcastChatDispose) {
      this.broadcastChatDispose()
      this.broadcastChatDispose = null
    }
    if (this.isInCurrentParcel && !this.livekitRoom) {
      this.connectViewer()
    } else if (this.isCohostMode() && this.livekitRoom) {
      this.cohostCompositeAttached = false
      this.updateCohostComposite()
    }
  }

  openBroadcastPanel(openOnly = false) {
    return openBroadcastPanel.call(this, openOnly)
  }

  onClick() {
    if (this.isAngleMirror()) {
      if (this.canBroadcastAngle()) this.openAnglePanel()
      else this.unblockAudiencePlayback()
      return
    }
    if (this.isMirror()) return
    if (this.hostDockAutoOpenedAt && Date.now() - this.hostDockAutoOpenedAt < 800) return
    if (!this.broadcastRoom) {
      const guest = isGuestForShowbox(this.uuid)
      if (this.isCohostMode()) {
        if (guest || this.parcel.canEdit) {
          this.openBroadcastPanel()
        } else {
          this.unblockAudiencePlayback()
        }
      } else if (!this.hasRemoteBroadcaster() && (guest || this.parcel.canEdit)) {
        this.openBroadcastPanel()
      } else {
        this.unblockAudiencePlayback()
      }
    }
    this.behaviours?.dispatch(this.uuid, 'click')
  }
}
