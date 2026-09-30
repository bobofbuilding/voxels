import { cameraError, cameraConstraints, mobileConstraints, wirePreview } from '../../../client/broadcast/media'
import { h } from 'preact'
import { holdMobileCanvasRefresh } from '../../controls/mobile/controls'
import { broadcastVideoTrackLive, fetchShowboxRoomToken, LIVEKIT_URL, livekitRoomState, saveShowboxPublisherIdentity } from '../../../client/broadcast/session'
import { showboxAudioConstraints, showboxRoomHint, SHOWBOX_ROOM_OPTIONS, type ShowboxAudioMode } from '../../../client/broadcast/audio'
import { VideoFxProcessor, FX_PALETTES, FX_DEFAULT_PALETTE, VIDEO_FX } from '../../../client/broadcast/video-fx'
import { exitPointerLock } from '../../../client/ui/helpers'
import { duckRadio } from '../../../web/src/radio/global'
import { broadcastLiveStartedAt } from '../../store'
import { consumeGuestFreshFromUrl } from '../../../client/broadcast/guest-pass'
import { effect } from '@preact/signals'
import { Room, Track, createLocalScreenTracks, createLocalTracks } from 'livekit-client'
import { app } from '../../../web/src/state'
import { PanelType } from '../../../web/src/components/panel'
import { chatLine } from '../../../web/src/shard-chat'
import { messageList } from '../../connector'
import { Animations } from '../../avatar-animations'
import { setCameraRotation } from '../../utils/camera'
import {
  DOCK_DANCES,
  DOCK_EMOJIS,
  COHOST_CONNECT_GRACE_MS,
  viewerCountLabel,
  mobile,
  syncVideoElFromTrack,
  makeDockPreviewVideo,
  isSyntheticGuestWallet,
  guestPassToken,
  isGuestForShowbox,
  showboxRoomTokenUrl,
  audienceShowUrl,
  wantsHostJoin,
  clearShowboxJoinParams,
  syncGuestDisplayName,
} from './context'
import type Showbox from './scene'

export function openBroadcastPanel(this: Showbox, openOnly = false) {
  if (this.isMirror()) return
  if (this.broadcastPanel) {
    if (openOnly) return
    this.dismissBroadcastPanel()
    this.stopBroadcast()
    this.clearBroadcastDockUi()
    return
  }

  if ((wantsHostJoin(this.uuid) || isGuestForShowbox(this.uuid)) && !this.joinDockAutoOpened) {
    this.joinDockAutoOpened = true
    clearShowboxJoinParams()
  }

  exitPointerLock()

  const isGuest = isGuestForShowbox(this.uuid)
  const syntheticGuest = isGuest && isSyntheticGuestWallet()
  if (syntheticGuest) consumeGuestFreshFromUrl((n) => app.setName(n))

  const panel = document.createElement('div')
  this.broadcastPanel = panel
  // mobile setup = full screen dock. mobile live defaults to large self-feed; toggle reveals voxels above.
  const MOBILE_WORLD_VIEW = '36vh'
  let mobileShowWorld = false
  let liveViewerCount = 0
  let mobilePreviewWrap: HTMLDivElement | null = null
  let mobilePreviewVideo: HTMLVideoElement | null = null
  let syncMobilePreview: (() => void) | null = null
  let clearMobileBroadcastHooks: (() => void) | null = null
  let mobileWorldBtn: HTMLButtonElement | null = null
  const refreshMobileWorldBtn = () => {
    if (!mobileWorldBtn) return
    mobileWorldBtn.textContent = mobileShowWorld ? 'see your feed' : viewerCountLabel(liveViewerCount)
  }
  let mobileStreamHint: HTMLDivElement | null = null
  let mobileExtrasBtn: HTMLButtonElement | null = null
  let mobileExtrasOpen = false
  const setMobileDockLayout = (live: boolean) => {
    if (!mobile) return
    if (!live) {
      mobileShowWorld = false
      panel.style.inset = '0'
      panel.style.top = '0'
      panel.style.left = '0'
      panel.style.right = '0'
      panel.style.bottom = '0'
      if (mobilePreviewWrap) mobilePreviewWrap.style.display = 'none'
      if (mobileStreamHint) mobileStreamHint.style.display = 'none'
      if (mobileWorldBtn) mobileWorldBtn.style.display = 'none'
      if (mobileExtrasBtn) mobileExtrasBtn.style.display = 'none'
      mobileExtrasOpen = false
      return
    }
    if (mobileShowWorld) {
      panel.style.inset = 'auto'
      panel.style.top = MOBILE_WORLD_VIEW
      panel.style.left = '0'
      panel.style.right = '0'
      panel.style.bottom = '0'
      if (mobilePreviewWrap) mobilePreviewWrap.style.display = 'none'
      if (mobileStreamHint) mobileStreamHint.style.display = 'block'
      refreshMobileWorldBtn()
    } else {
      panel.style.inset = '0'
      panel.style.top = '0'
      panel.style.left = '0'
      panel.style.right = '0'
      panel.style.bottom = '0'
      if (mobilePreviewWrap) mobilePreviewWrap.style.display = 'block'
      if (mobileStreamHint) mobileStreamHint.style.display = 'none'
      refreshMobileWorldBtn()
    }
    if (mobileWorldBtn) mobileWorldBtn.style.display = 'block'
    panel.style.overflow = live ? 'hidden' : 'auto'
    if (live) {
      panel.style.padding = '0.75rem'
      panel.style.paddingBottom = 'max(6px, env(safe-area-inset-bottom))'
      panel.style.minHeight = '0'
    }
  }
  const setDesktopDockLayout = (live: boolean) => {
    if (mobile) return
    if (this.broadcastPanelSidebar) {
      panel.style.width = '100%'
      panel.style.maxHeight = 'none'
      panel.style.top = 'auto'
      panel.style.right = 'auto'
      panel.style.left = 'auto'
      panel.style.transform = 'none'
      return
    }
    panel.style.top = live ? '12px' : '50%'
    panel.style.right = live ? '12px' : 'auto'
    panel.style.left = live ? 'auto' : '50%'
    panel.style.bottom = 'auto'
    panel.style.transform = live ? 'none' : 'translate(-50%, -50%)'
    panel.style.width = '340px'
    panel.style.maxHeight = live ? 'calc(100vh - 24px)' : '85vh'
  }
  if (mobile) {
    mobileWorldBtn = document.createElement('button')
    mobileWorldBtn.type = 'button'
    mobileWorldBtn.textContent = viewerCountLabel(0)
    Object.assign(mobileWorldBtn.style, {
      display: 'none',
      background: 'transparent',
      color: '#888',
      border: '0',
      padding: '0',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '12px',
      textDecoration: 'underline',
      flexShrink: '0',
    })
    mobileWorldBtn.onclick = () => {
      mobileShowWorld = !mobileShowWorld
      setMobileDockLayout(true)
      const cam = window.connector?.controls?.camera
      if (cam) {
        // host spawns facing the screen; audience stands further out in the opposite direction
        const yaw = this.rotation.y + (mobileShowWorld ? Math.PI : 0)
        setCameraRotation(this.scene, new BABYLON.Vector3(cam.rotation.x, yaw, cam.rotation.z))
      }
    }
    mobileExtrasBtn = document.createElement('button')
    mobileExtrasBtn.type = 'button'
    mobileExtrasBtn.textContent = 'emotes'
    Object.assign(mobileExtrasBtn.style, {
      display: 'none',
      background: 'transparent',
      color: '#888',
      border: '0',
      padding: '4px 0',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '12px',
      textAlign: 'left',
      textDecoration: 'underline',
      flexShrink: '0',
    })
    mobileExtrasBtn.onclick = () => {
      mobileExtrasOpen = !mobileExtrasOpen
      moveRow.style.display = mobileExtrasOpen ? 'flex' : 'none'
      mobileExtrasBtn!.textContent = mobileExtrasOpen ? 'hide emotes' : 'emotes'
    }
  }
  if (mobile) {
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '999999',
      inset: '0',
      background: '#0d0d0d',
      color: '#f5f5f0',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      overflowY: 'auto',
      fontFamily: '"Source Code Pro", monospace',
      fontSize: '15px',
    })
  } else {
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '999999',
      background: '#0d0d0d',
      color: '#f5f5f0',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      overflowY: 'auto',
      fontFamily: '"Source Code Pro", monospace',
      fontSize: '13px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
    })
    setDesktopDockLayout(false)
  }

  const title = document.createElement('div')
  title.textContent = 'Showbox'
  title.style.fontWeight = 'bold'
  title.style.fontSize = '16px'

  const camLabel = document.createElement('label')
  camLabel.textContent = 'camera'
  const camSel = document.createElement('select')
  Object.assign(camSel.style, { width: '100%', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: '4px' })

  const micLabel = document.createElement('label')
  micLabel.textContent = 'microphone'
  const micSel = document.createElement('select')
  Object.assign(micSel.style, { width: '100%', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: '4px' })
  const audioModeLabel = document.createElement('label')
  audioModeLabel.textContent = "what's your room like?"
  const audioModeSel = document.createElement('select')
  Object.assign(audioModeSel.style, { width: '100%', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: '4px' })
  let audioMode: ShowboxAudioMode = 'voice'
  for (const opt of SHOWBOX_ROOM_OPTIONS) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    audioModeSel.appendChild(o)
  }
  const audioModeHint = document.createElement('small')
  audioModeHint.textContent = showboxRoomHint(audioMode)
  Object.assign(audioModeHint.style, { color: '#888', display: 'block' })
  audioModeSel.onchange = () => {
    audioMode = audioModeSel.value as ShowboxAudioMode
    audioModeHint.textContent = showboxRoomHint(audioMode)
  }
  if (mobile) {
    Object.assign(camSel.style, { fontSize: '16px', minHeight: '44px', padding: '8px' })
    Object.assign(micSel.style, { fontSize: '16px', minHeight: '44px', padding: '8px' })
    Object.assign(audioModeSel.style, { fontSize: '16px', minHeight: '44px', padding: '8px' })
  }

  const screenOpt = document.createElement('label')
  const screenChk = document.createElement('input')
  screenChk.type = 'checkbox'
  screenOpt.append(screenChk, ' use screenshare instead of camera')
  const screenHint = document.createElement('small')
  screenHint.textContent = 'make sure you select share system audio on the next screen if you need shared audio'
  screenHint.style.color = '#888'
  screenHint.style.display = 'none'
  screenChk.onchange = () => {
    screenHint.style.display = screenChk.checked ? 'block' : 'none'
    // screenshare grabs your screen + system audio, not your camera/mic - hide the device pickers so it is not misleading.
    deviceRow.style.display = screenChk.checked ? 'none' : 'flex'
  }
  if (mobile) screenOpt.style.display = 'none' // screenshare from a phone is unreliable; stick to the camera

  // "open with a 'starting soon' screen": go live straight into the standby card so the audience
  // gathers behind it before the show starts. Checking it reveals the message + countdown fields.
  const standbyFieldStyle: Record<string, string> = { width: '100%', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: mobile ? '10px' : '6px' }
  if (mobile) Object.assign(standbyFieldStyle, { fontSize: '16px', minHeight: '44px' })
  const standbyOpt = document.createElement('label')
  Object.assign(standbyOpt.style, { display: 'flex', alignItems: 'center', gap: '6px' })
  const standbyChk = document.createElement('input')
  standbyChk.type = 'checkbox'
  standbyOpt.append(standbyChk, " open with a 'starting soon' screen")
  const standbyConfig = document.createElement('div')
  Object.assign(standbyConfig.style, { display: 'none', flexDirection: 'column', gap: '4px', paddingLeft: mobile ? '0' : '22px' })
  const standbyMsgInput = document.createElement('input')
  standbyMsgInput.type = 'text'
  standbyMsgInput.value = 'starting soon'
  standbyMsgInput.maxLength = 40
  Object.assign(standbyMsgInput.style, standbyFieldStyle)
  const standbyMinInput = document.createElement('input')
  standbyMinInput.type = 'number'
  standbyMinInput.min = '1'
  standbyMinInput.placeholder = 'minutes until start (optional)'
  Object.assign(standbyMinInput.style, standbyFieldStyle)
  standbyConfig.append(standbyMsgInput, standbyMinInput)
  standbyChk.onchange = () => {
    standbyConfig.style.display = standbyChk.checked ? 'flex' : 'none'
  }

  const deviceRow = document.createElement('div')
  Object.assign(deviceRow.style, { display: 'flex', flexDirection: 'column', gap: '4px' })
  if (mobile) {
    camLabel.style.display = 'block'
    micLabel.style.display = 'block'
    audioModeLabel.style.display = 'block'
  }
  deviceRow.append(camLabel, camSel, micLabel, micSel, audioModeLabel, audioModeSel, audioModeHint)

  const deviceToggle = document.createElement('button')
  deviceToggle.type = 'button'
  deviceToggle.textContent = 'change camera or mic'
  Object.assign(deviceToggle.style, {
    display: 'none',
    background: 'transparent',
    color: '#888',
    border: '0',
    padding: '4px 0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    textAlign: 'left',
    textDecoration: 'underline',
  })
  deviceToggle.onclick = () => {
    const open = deviceRow.style.display !== 'none'
    deviceRow.style.display = open ? 'none' : 'flex'
    deviceToggle.textContent = open ? 'change camera or mic' : 'hide camera and mic'
  }

  // Mobile one-tap camera flip. facingMode front/back is reliable on phones where deviceId enumeration is flaky.
  let flipFacing: 'user' | 'environment' = 'user'
  this.mobileFlipFacing = 'user'
  const cameraReconnectBtn = document.createElement('button')
  cameraReconnectBtn.type = 'button'
  cameraReconnectBtn.textContent = 'reconnect camera'
  Object.assign(cameraReconnectBtn.style, {
    display: 'none',
    background: 'var(--red)',
    color: '#fff',
    border: '0',
    padding: mobile ? '8px 12px' : '6px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: mobile ? '14px' : '12px',
    fontWeight: 'bold',
    width: mobile ? '100%' : 'auto',
    minHeight: mobile ? '40px' : '32px',
  })
  cameraReconnectBtn.onclick = () => void this.tryResumeCamera()
  this.broadcastCameraReconnectBtn = cameraReconnectBtn
  const flipBtn = document.createElement('button')
  flipBtn.type = 'button'
  flipBtn.textContent = 'flip camera'
  Object.assign(flipBtn.style, {
    display: 'none',
    background: 'transparent',
    color: '#888',
    border: '0',
    padding: '4px 0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    textAlign: 'left',
    textDecoration: 'underline',
  })
  flipBtn.onclick = async () => {
    if (!this.broadcastRoom || !liveVideoTrack) return
    flipFacing = flipFacing === 'user' ? 'environment' : 'user'
    this.mobileFlipFacing = flipFacing
    await liveVideoTrack.restartTrack(mobileConstraints(flipFacing, 'portrait')).catch(() => {})
    this.wireCameraEndedListener(liveVideoTrack)
    if (this.broadcastRoom) this.noteCameraHealthy(this.broadcastRoom)
    this.syncBroadcastVideoFromTrack(liveVideoTrack)
    requestAnimationFrame(() => this.syncBroadcastVideoFromTrack(liveVideoTrack))
  }

  // livekit mutes/unmutes the published mic without killing video. screenshare starts muted; camera starts on.
  let micOn = false
  const micToggle = document.createElement('button')
  micToggle.type = 'button'
  micToggle.textContent = 'turn on mic'
  Object.assign(micToggle.style, {
    display: 'none',
    background: '#1a1a1a',
    color: '#888',
    border: '1px solid #333',
    padding: '8px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '36px',
  })
  const syncMicToggle = () => {
    if (!micOn) {
      micToggle.textContent = screenChk.checked ? 'turn on mic' : 'unmute mic'
      micToggle.style.color = '#888'
      return
    }
    micToggle.textContent = 'mute mic'
    micToggle.style.color = '#f5f5f0'
  }
  micToggle.onclick = async () => {
    if (!this.broadcastRoom) return
    micOn = !micOn
    micToggle.disabled = true
    // mic is already published at go-live - deviceId on unmute can open a second audio track (echo).
    // when there never was a mic, publish with the chosen room preset, not livekit defaults.
    const micOpts = micOn && !liveAudioTrack ? showboxAudioConstraints(audioMode, micSel.value || undefined) : undefined
    await this.broadcastRoom.localParticipant.setMicrophoneEnabled(micOn, micOpts).catch(() => (micOn = !micOn))
    micToggle.disabled = false
    syncMicToggle()
  }

  // Name row only for anonymous guests on /live/ links. Signed-in users keep their account name.
  const guestToken = syntheticGuest ? guestPassToken() : null
  let guestNameInput: HTMLInputElement | null = null
  let identityRow: HTMLDivElement | null = null
  if (syntheticGuest && guestToken) {
    identityRow = document.createElement('div')
    Object.assign(identityRow.style, { display: 'flex', flexDirection: 'column', gap: '4px' })
    const identityLabel = document.createElement('label')
    identityLabel.textContent = 'Name'
    const nameInput = document.createElement('input')
    guestNameInput = nameInput
    nameInput.type = 'text'
    nameInput.value = ''
    nameInput.placeholder = 'e.g. DJ ANON'
    nameInput.maxLength = 64
    Object.assign(nameInput.style, {
      width: '100%',
      background: '#1a1a1a',
      color: '#f5f5f0',
      border: '1px solid #333',
      padding: '8px',
      fontFamily: 'inherit',
      minHeight: mobile ? '44px' : '36px',
      fontSize: mobile ? '16px' : 'inherit',
      boxSizing: 'border-box',
    })
    const nameStatus = document.createElement('small')
    nameStatus.style.color = '#888'
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    const save = async (reconnectMp = false) => {
      const next = nameInput.value.trim()
      if (!next || next === app.state.name) return
      nameStatus.textContent = 'saving...'
      try {
        const r = await fetch(`/api/guest/${guestToken}/name`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: next }),
        })
        const j = await r.json()
        if (!j.success) throw new Error(j.error || 'failed')
        if (reconnectMp) syncGuestDisplayName(next)
        else app.setName(next)
        nameStatus.textContent = 'saved'
        setTimeout(() => (nameStatus.textContent = ''), 1500)
      } catch (e) {
        nameStatus.textContent = (e as Error)?.message || 'could not save'
      }
    }
    nameInput.oninput = () => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => save(false), 600)
    }
    nameInput.onblur = () => save(true)
    identityRow.append(identityLabel, nameInput, nameStatus)
  }

  // Fan coords link - audience spawns back from the screen, slightly off center.
  let shareRow: HTMLDivElement | null = null
  {
    const showUrl = audienceShowUrl(this)
    shareRow = document.createElement('div')
    Object.assign(shareRow.style, { display: 'none', flexDirection: 'column', gap: '4px', borderTop: '1px solid #222', borderBottom: '1px solid #222', padding: '8px 0' })
    const shareLabel = document.createElement('label')
    shareLabel.textContent = mobile ? 'fan link' : 'fan link - share with your audience'
    shareLabel.style.color = '#888'
    const shareInput = document.createElement('input')
    shareInput.type = 'text'
    shareInput.readOnly = true
    shareInput.value = showUrl
    Object.assign(shareInput.style, { width: '100%', boxSizing: 'border-box', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: '8px', fontFamily: 'inherit', minHeight: '36px' })
    shareInput.onclick = () => shareInput.select()
    const shareBtnRow = document.createElement('div')
    Object.assign(shareBtnRow.style, { display: 'flex', gap: '0.5rem' })
    const copyBtn = document.createElement('button')
    copyBtn.textContent = 'copy'
    Object.assign(copyBtn.style, { background: '#333', color: '#f5f5f0', border: '0', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', minHeight: '36px' })
    const copyBtnLabel = 'copy'
    const xBtn = document.createElement('button')
    xBtn.textContent = 'post on x'
    Object.assign(xBtn.style, { background: '#333', color: '#f5f5f0', border: '0', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', minHeight: '36px' })
    const wireDesktopShareActions = (getKind: () => 'fan' | 'guest', getUrl: () => string) => {
      copyBtn.onclick = async () => {
        let url = getUrl().trim()
        if (getKind() === 'guest') {
          shareInput.value = 'loading guest link...'
          const guestUrl = await this.resolveGuestShareUrl()
          if (!guestUrl) {
            shareInput.value = showUrl
            return
          }
          shareInput.value = guestUrl
          url = guestUrl
        }
        if (!url || url.startsWith('loading')) return
        navigator.clipboard.writeText(url).catch(() => {})
        copyBtn.textContent = 'copied'
        setTimeout(() => (copyBtn.textContent = copyBtnLabel), 1500)
      }
      xBtn.onclick = async () => {
        let url = getUrl().trim()
        if (getKind() === 'guest') {
          const guestUrl = await this.resolveGuestShareUrl()
          if (!guestUrl) return
          url = guestUrl
          shareInput.value = guestUrl
        }
        if (!url || url.startsWith('loading')) return
        const text = getKind() === 'guest' ? `Join my show on camera in voxels: ${url}` : `Going live in voxels - Teleport in! ${url}`
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
      }
    }
    const runMobileShare = async (kind: 'fan' | 'guest') => {
      if (kind === 'guest') {
        const guestUrl = await this.resolveGuestShareUrl()
        if (!guestUrl) {
          if (!this.canManageGuestPasses()) app.showSnackbar('no guest link yet - ask someone with edit access', PanelType.Warning)
          return
        }
        await this.shareShowUrl(guestUrl, `Join my show on camera in voxels: ${guestUrl}`)
        return
      }
      await this.shareShowUrl(showUrl, `Going live in voxels - Teleport in! ${showUrl}`)
    }
    const shareBtn = document.createElement('button')
    shareBtn.textContent = 'share'
    Object.assign(shareBtn.style, { background: '#333', color: '#f5f5f0', border: '0', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', minHeight: '36px' })
    shareBtn.onclick = () => void runMobileShare('fan')
    shareBtnRow.append(copyBtn)
    if (!mobile) shareBtnRow.append(xBtn)
    shareLabel.style.display = 'block'
    if (mobile) {
      Object.assign(shareRow.style, { padding: '4px 0', borderTop: '1px solid #222', borderBottom: 'none', gap: '2px' })
      if (this.parcel.canEdit) {
        let shareLinkKind: 'fan' | 'guest' = 'fan'
        const shareSplit = document.createElement('div')
        Object.assign(shareSplit.style, { display: 'flex', width: '100%', position: 'relative' })
        const shareMainBtn = document.createElement('button')
        const sharePickBtn = document.createElement('button')
        const sharePickMenu = document.createElement('div')
        const btnBase = { background: 'var(--red)', color: '#f5f5f0', border: '0', cursor: 'pointer', fontFamily: 'inherit', minHeight: '32px' as const }
        const syncShareLabel = () => {
          shareMainBtn.textContent = shareLinkKind === 'fan' ? 'share fan link' : 'share co-host link'
        }
        const closeSharePickMenu = () => {
          sharePickMenu.style.display = 'none'
        }
        const pickShareKind = (kind: 'fan' | 'guest') => {
          shareLinkKind = kind
          syncShareLabel()
          closeSharePickMenu()
        }
        Object.assign(shareMainBtn.style, { ...btnBase, flex: '1', fontWeight: 'bold', padding: '6px 8px' })
        Object.assign(sharePickBtn.style, { ...btnBase, padding: '6px 12px', borderLeft: '1px solid rgba(245, 245, 240, 0.45)', flexShrink: '0', minWidth: '40px' })
        sharePickBtn.textContent = 'v'
        sharePickBtn.title = 'pick fan or guest link'
        Object.assign(sharePickMenu.style, {
          display: 'none',
          flexDirection: 'column',
          position: 'absolute',
          bottom: '100%',
          left: '0',
          right: '0',
          background: '#1a1a1a',
          border: '1px solid #333',
          marginBottom: '2px',
          zIndex: '5',
        })
        const fanPick = document.createElement('button')
        fanPick.type = 'button'
        fanPick.textContent = 'fan link - for people watching'
        Object.assign(fanPick.style, { background: '#1a1a1a', color: '#f5f5f0', border: '0', borderBottom: '1px solid #333', padding: '8px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minHeight: '32px' })
        fanPick.onclick = () => pickShareKind('fan')
        const guestPick = document.createElement('button')
        guestPick.type = 'button'
        guestPick.textContent = 'co-host link - for your DJ or guest on camera'
        Object.assign(guestPick.style, { background: '#1a1a1a', color: '#f5f5f0', border: '0', padding: '8px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minHeight: '32px' })
        guestPick.onclick = () => pickShareKind('guest')
        sharePickMenu.append(fanPick, guestPick)
        syncShareLabel()
        shareMainBtn.onclick = () => {
          closeSharePickMenu()
          void runMobileShare(shareLinkKind)
        }
        sharePickBtn.onclick = (e) => {
          e.stopPropagation()
          sharePickMenu.style.display = sharePickMenu.style.display === 'none' ? 'flex' : 'none'
        }
        shareSplit.append(shareMainBtn, sharePickBtn, sharePickMenu)
        shareRow.append(shareSplit)
      } else {
        shareBtn.textContent = 'share fan link'
        Object.assign(shareBtn.style, { background: 'var(--red)', fontWeight: 'bold', width: '100%', minHeight: '32px', padding: '6px 8px', fontSize: '12px' })
        shareBtnRow.append(shareBtn)
        shareRow.append(shareBtnRow)
      }
    } else if (this.canManageGuestPasses()) {
      let shareLinkKind: 'fan' | 'guest' = 'fan'
      const shareKindSel = document.createElement('select')
      Object.assign(shareKindSel.style, {
        width: '100%',
        background: '#1a1a1a',
        color: '#888',
        border: '1px solid #333',
        padding: '4px',
        fontFamily: 'inherit',
      })
      const fanOpt = document.createElement('option')
      fanOpt.value = 'fan'
      fanOpt.textContent = 'fan link - for people watching'
      const guestOpt = document.createElement('option')
      guestOpt.value = 'guest'
      guestOpt.textContent = 'co-host link - for your DJ or guest on camera'
      shareKindSel.append(fanOpt, guestOpt)
      const syncShareUrl = async () => {
        if (shareLinkKind === 'fan') {
          shareInput.value = showUrl
          return
        }
        shareInput.value = 'loading guest link...'
        const guestUrl = await this.resolveGuestShareUrl()
        if (!guestUrl) {
          shareLinkKind = 'fan'
          shareKindSel.value = 'fan'
          shareInput.value = showUrl
          return
        }
        shareInput.value = guestUrl
      }
      shareKindSel.onchange = () => {
        shareLinkKind = shareKindSel.value === 'guest' ? 'guest' : 'fan'
        void syncShareUrl()
      }
      wireDesktopShareActions(
        () => shareLinkKind,
        () => shareInput.value,
      )
      shareRow.append(shareKindSel, shareInput, shareBtnRow)
    } else {
      wireDesktopShareActions(
        () => 'fan',
        () => showUrl,
      )
      shareRow.append(shareLabel, shareInput, shareBtnRow)
    }
  }

  // quick-access dance + emoji reactions. Hidden until live - pre-stream they just add noise,
  // mid-stream they are the main way to react to chat without leaving the dock.
  const moveRow = document.createElement('div')
  Object.assign(moveRow.style, { display: 'none', flexDirection: 'column', gap: '4px' })
  const danceRow = document.createElement('div')
  Object.assign(danceRow.style, { display: 'flex', gap: '4px', flexWrap: 'wrap' })
  const playMove = (anim: Animations | null) => {
    const persona = window.persona
    const controls = window.connector?.controls
    if (!persona || !controls) return
    persona.playEmote(anim)
  }
  DOCK_DANCES.forEach((d) => {
    const b = document.createElement('button')
    b.textContent = d.label
    Object.assign(b.style, { background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', minWidth: '60px', minHeight: '36px' })
    b.onclick = () => playMove(d.anim)
    danceRow.appendChild(b)
  })
  const stopMoveBtn = document.createElement('button')
  stopMoveBtn.textContent = 'idle'
  Object.assign(stopMoveBtn.style, { background: '#1a1a1a', color: '#888', border: '1px solid #333', padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', minWidth: '60px', minHeight: '36px' })
  stopMoveBtn.onclick = () => playMove(null)
  danceRow.appendChild(stopMoveBtn)

  const emojiRow = document.createElement('div')
  Object.assign(emojiRow.style, { display: 'flex', gap: '4px', flexWrap: 'wrap' })
  DOCK_EMOJIS.forEach((e) => {
    const b = document.createElement('button')
    b.textContent = e
    Object.assign(b.style, { background: '#1a1a1a', border: '1px solid #333', padding: '6px 8px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', fontSize: '18px', minWidth: '40px', minHeight: '36px' })
    b.onclick = () => window.connector?.emote(e)
    emojiRow.appendChild(b)
  })
  // "visual board": tab between the emote reactions and live video FX on the broadcast (desktop only).
  const reactRow = document.createElement('div')
  Object.assign(reactRow.style, { display: 'flex', flexDirection: 'column', gap: '4px' })
  reactRow.append(danceRow, emojiRow)

  let fxTabs: HTMLDivElement | null = null
  let fxRow: HTMLDivElement | null = null
  // solo-mode desktop preview is its own <video> bound to the raw track; captured here so the fx
  // toggle can re-point it to the processed track too (cohost mode's preview is the composite, which
  // already follows). assigned when the desktop preview is built.
  let fxSoloPreviewEl: HTMLVideoElement | null = null
  if (!mobile) {
    const tabStyle = (active: boolean): Record<string, string> => ({
      background: active ? '#333' : '#1a1a1a',
      color: active ? '#f5f5f0' : '#888',
      border: '1px solid #333',
      padding: '6px 10px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      flex: '1',
      minHeight: '32px',
    })
    const emotesTab = document.createElement('button')
    emotesTab.type = 'button'
    emotesTab.textContent = 'emotes'
    Object.assign(emotesTab.style, tabStyle(true))
    const fxTab = document.createElement('button')
    fxTab.type = 'button'
    fxTab.textContent = 'fx'
    Object.assign(fxTab.style, tabStyle(false))
    fxTabs = document.createElement('div')
    Object.assign(fxTabs.style, { display: 'flex', gap: '4px' })
    fxTabs.append(emotesTab, fxTab)

    fxRow = document.createElement('div')
    Object.assign(fxRow.style, { display: 'none', flexDirection: 'column', gap: '6px' })
    const fxHint = document.createElement('small')
    fxHint.textContent = 'live effect on your broadcast - reacts to your audio.'
    fxHint.style.color = '#888'
    // active effect (null = off), palette, per-effect remembered slider positions, and auto-mode state
    let fxActiveKey: string | null = null
    let fxPalette = FX_DEFAULT_PALETTE
    const fxSliderByKey: Record<string, number> = {}
    VIDEO_FX.forEach((f) => (fxSliderByKey[f.key] = f.defaultSlider))
    const MANUAL_FADE_MS = 500
    // auto mode: crossfade through a chosen subset of effects on a hold + fade timer
    let autoOn = false
    const autoSet = new Set<string>()
    let holdMs = 8000
    let fadeMs = 4000

    // palette picker (Voxelator colors) - applies to whichever effect is active
    const paletteSel = document.createElement('select')
    Object.assign(paletteSel.style, { background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: '6px', fontFamily: 'inherit' })
    FX_PALETTES.forEach((p, i) => {
      const o = document.createElement('option')
      o.value = String(i)
      o.textContent = p.label
      paletteSel.appendChild(o)
    })
    paletteSel.onchange = () => {
      fxPalette = FX_PALETTES[parseInt(paletteSel.value, 10) || 0].lut
      this.broadcastFxProcessor?.setPalette(fxPalette)
    }

    // one slider for the active effect's parameter (right = stronger/faster for every effect)
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '0'
    slider.max = '100'
    slider.step = '1'
    slider.value = '50'
    slider.style.width = '100%'
    slider.oninput = () => {
      const v = (parseInt(slider.value, 10) || 50) / 100
      if (fxActiveKey) fxSliderByKey[fxActiveKey] = v // remember it for this effect
      this.broadcastFxProcessor?.setSlider(v)
    }

    const fxGrid = document.createElement('div')
    Object.assign(fxGrid.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' })
    const fxButtons: Record<string, HTMLButtonElement> = {}
    // tile look: the effect on screen is red; in auto mode, effects in the rotation are amber, others dim.
    const refreshTiles = () => {
      Object.entries(fxButtons).forEach(([k, b]) => {
        const showing = k === fxActiveKey
        const inSet = autoSet.has(k)
        b.style.background = showing ? 'var(--red)' : '#1a1a1a'
        if (showing) {
          b.style.color = '#fff'
          b.style.border = '1px solid var(--red)'
        } else if (autoOn) {
          b.style.color = inSet ? '#f5b942' : '#888'
          b.style.border = inSet ? '1px solid #5a4718' : '1px solid #333'
        } else {
          b.style.color = '#f5f5f0'
          b.style.border = '1px solid #333'
        }
      })
    }

    // manual: turn fx on / crossfade between effects / turn off (tap the active one)
    const selectFx = async (key: string) => {
      if (!this.broadcastRoom || !liveVideoTrack) {
        app.showSnackbar('go live first to use fx', PanelType.Warning)
        return
      }
      const turningOff = fxActiveKey === key
      Object.values(fxButtons).forEach((b) => (b.disabled = true))
      try {
        if (turningOff) {
          await liveVideoTrack.stopProcessor()
          this.broadcastFxProcessor = null
          fxActiveKey = null
        } else if (!this.broadcastFxProcessor) {
          this.broadcastFxProcessor = new VideoFxProcessor(() => this.fxAudio)
          this.broadcastFxProcessor.setPalette(fxPalette)
          this.broadcastFxProcessor.setEffect(key)
          this.broadcastFxProcessor.setSlider(fxSliderByKey[key] ?? 0.5)
          await liveVideoTrack.setProcessor(this.broadcastFxProcessor)
          fxActiveKey = key
        } else {
          // crossfade to the new effect on the running processor; restore its remembered slider
          this.broadcastFxProcessor.setEffect(key, MANUAL_FADE_MS)
          this.broadcastFxProcessor.setSlider(fxSliderByKey[key] ?? 0.5)
          fxActiveKey = key
        }
      } catch (e) {
        console.error('showbox: fx toggle failed', e)
        if (this.broadcastFxProcessor) {
          void this.broadcastFxProcessor.destroy?.()
          this.broadcastFxProcessor = null
        }
        fxActiveKey = null
        app.showSnackbar('could not apply effect', PanelType.Warning)
      }
      // turning fx on/off swaps liveVideoTrack.mediaStreamTrack (processed <-> raw); re-point the host's
      // own view so they see what the audience sees (switching effects keeps the same processed track).
      this.syncBroadcastVideoFromTrack(liveVideoTrack)
      requestAnimationFrame(() => this.syncBroadcastVideoFromTrack(liveVideoTrack))
      if (fxSoloPreviewEl) syncVideoElFromTrack(fxSoloPreviewEl, liveVideoTrack)
      Object.values(fxButtons).forEach((b) => (b.disabled = false))
      refreshTiles()
      slider.value = String(Math.round((fxActiveKey ? fxSliderByKey[fxActiveKey] : 0.5) * 100))
    }

    // auto-mode driver: step to the next effect in the rotation, crossfading over `fadeMs`
    const stopAuto = () => {
      if (this.fxAutoTimer) {
        clearTimeout(this.fxAutoTimer)
        this.fxAutoTimer = null
      }
    }
    const autoStep = () => {
      // self-terminate if fx ended or the dock was closed (closure autoOn can't be reached from teardown)
      if (!autoOn || !this.broadcastFxProcessor || !this.broadcastPanel) {
        stopAuto()
        return
      }
      const members = VIDEO_FX.map((f) => f.key).filter((k) => autoSet.has(k))
      if (members.length < 2) {
        this.fxAutoTimer = setTimeout(autoStep, holdMs) // nothing to cross to - just wait
        return
      }
      const curIdx = members.indexOf(fxActiveKey ?? members[0])
      const next = members[(curIdx + 1) % members.length]
      this.broadcastFxProcessor.setEffect(next, fadeMs)
      this.broadcastFxProcessor.setSlider(fxSliderByKey[next] ?? 0.5)
      fxActiveKey = next
      slider.value = String(Math.round((fxSliderByKey[next] ?? 0.5) * 100))
      refreshTiles()
      this.fxAutoTimer = setTimeout(autoStep, holdMs + fadeMs)
    }
    const startAuto = async () => {
      const members = VIDEO_FX.map((f) => f.key).filter((k) => autoSet.has(k))
      if (!this.broadcastFxProcessor && members.length) await selectFx(members[0])
      stopAuto()
      this.fxAutoTimer = setTimeout(autoStep, holdMs)
    }

    // hold + fade sliders (shown only in auto mode)
    const labeledSlider = (label: string, min: number, max: number, val: number, onChange: (s: number) => void) => {
      const wrap = document.createElement('label')
      Object.assign(wrap.style, { display: 'none', alignItems: 'center', gap: '8px', color: '#888', fontSize: '12px' })
      const span = document.createElement('span')
      span.textContent = label
      span.style.minWidth = '32px'
      const r = document.createElement('input')
      r.type = 'range'
      r.min = String(min)
      r.max = String(max)
      r.step = '0.5'
      r.value = String(val)
      r.style.flex = '1'
      const out = document.createElement('span')
      out.style.minWidth = '34px'
      const sync = () => (out.textContent = r.value + 's')
      r.oninput = () => {
        sync()
        onChange(parseFloat(r.value) || val)
      }
      sync()
      wrap.append(span, r, out)
      return wrap
    }
    const holdRow = labeledSlider('hold', 1, 60, 8, (s) => (holdMs = s * 1000))
    const fadeRow = labeledSlider('fade', 0.5, 30, 4, (s) => (fadeMs = s * 1000))

    // auto on/off toggle
    const autoBtn = document.createElement('button')
    autoBtn.type = 'button'
    Object.assign(autoBtn.style, { padding: '8px', cursor: 'pointer', fontFamily: 'inherit', minHeight: '36px', fontWeight: 'bold', border: '1px solid #333' })
    const syncAutoBtn = () => {
      autoBtn.textContent = autoOn ? 'auto: on' : 'auto: off'
      autoBtn.style.background = autoOn ? 'var(--red)' : '#1a1a1a'
      autoBtn.style.color = autoOn ? '#fff' : '#888'
    }
    syncAutoBtn()
    autoBtn.onclick = () => {
      if (!this.broadcastRoom || !liveVideoTrack) {
        app.showSnackbar('go live first to use fx', PanelType.Warning)
        return
      }
      autoOn = !autoOn
      if (autoOn) {
        if (autoSet.size === 0) VIDEO_FX.forEach((f) => autoSet.add(f.key)) // default: cycle all of them
        holdRow.style.display = 'flex'
        fadeRow.style.display = 'flex'
        fxHint.textContent = 'auto: cross-fading the highlighted effects. tap tiles to add/remove.'
        void startAuto()
      } else {
        stopAuto()
        holdRow.style.display = 'none'
        fadeRow.style.display = 'none'
        fxHint.textContent = 'live effect on your broadcast - reacts to your audio.'
      }
      syncAutoBtn()
      refreshTiles()
    }

    VIDEO_FX.forEach((fx) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = fx.label
      Object.assign(b.style, { padding: '10px', cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px', fontWeight: 'bold' })
      b.onclick = () => {
        if (autoOn) {
          // curate the rotation: add/remove this effect
          if (autoSet.has(fx.key)) {
            if (autoSet.size <= 1) return // keep at least one effect in the rotation
            autoSet.delete(fx.key)
            // if we removed the effect currently on screen, cross to a remaining one now so the
            // highlight isn't stuck on a non-member
            if (fxActiveKey === fx.key && this.broadcastFxProcessor) {
              const next = VIDEO_FX.map((f) => f.key).filter((k) => autoSet.has(k))[0]
              if (next) {
                this.broadcastFxProcessor.setEffect(next, MANUAL_FADE_MS)
                this.broadcastFxProcessor.setSlider(fxSliderByKey[next] ?? 0.5)
                fxActiveKey = next
                slider.value = String(Math.round((fxSliderByKey[next] ?? 0.5) * 100))
              }
            }
          } else {
            autoSet.add(fx.key)
          }
          refreshTiles()
        } else {
          void selectFx(fx.key)
        }
      }
      fxButtons[fx.key] = b
      fxGrid.appendChild(b)
    })
    refreshTiles()

    fxRow.append(fxHint, autoBtn, fxGrid, slider, paletteSel, holdRow, fadeRow)

    const selectTab = (fx: boolean) => {
      reactRow.style.display = fx ? 'none' : 'flex'
      fxRow!.style.display = fx ? 'flex' : 'none'
      Object.assign(emotesTab.style, tabStyle(!fx))
      Object.assign(fxTab.style, tabStyle(fx))
    }
    emotesTab.onclick = () => selectTab(false)
    fxTab.onclick = () => selectTab(true)
  }

  if (fxTabs && fxRow) moveRow.append(fxTabs, reactRow, fxRow)
  else moveRow.append(reactRow)

  const status = document.createElement('div')
  status.style.color = '#888'

  const goBtn = document.createElement('button')
  goBtn.type = 'button'
  goBtn.textContent = 'go live'
  Object.assign(goBtn.style, { background: 'var(--red)', color: '#f5f5f0', border: '0', padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit', flex: '2', minHeight: '44px', fontWeight: 'bold' })

  // Intermission control. A small secondary button left of "stop streaming" (in both the desktop and
  // mobile docks, since both append `row`), hidden until live. Raise opens the setup dialog; return is
  // one tap. The dock preview stays a live mirror of your camera during standby (so you can check your
  // look) - we just relabel it. The label ref is assigned when the preview is built.
  let intermissionPreviewLabel: HTMLElement | null = null
  // cold-open "starting soon" via the go-live checkbox sets these: standbyStartLabel makes the
  // return button read "start show" instead of "back to live"; pendingStandby is raised once live.
  let standbyStartLabel = false
  let pendingStandby: { label: string; mins: number | null } | null = null
  const intermissionBtn = document.createElement('button')
  intermissionBtn.type = 'button'
  intermissionBtn.textContent = 'take a break'
  Object.assign(intermissionBtn.style, {
    display: 'none',
    background: 'transparent',
    color: '#f5b942',
    border: '1px solid #5a4718',
    padding: mobile ? '10px 12px' : '6px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
    fontSize: mobile ? '14px' : '12px',
    minHeight: mobile ? '44px' : 'auto',
    whiteSpace: 'nowrap',
  })
  const syncIntermissionUi = () => {
    const on = !!this.intermission
    intermissionBtn.textContent = on ? (standbyStartLabel ? 'start show' : 'back to live') : 'take a break'
    // on break the return button fills in (the action to get back on); idle it's a quiet amber outline
    intermissionBtn.style.background = on ? 'var(--red)' : 'transparent'
    intermissionBtn.style.color = on ? '#f5f5f0' : '#f5b942'
    intermissionBtn.style.borderColor = on ? 'var(--red)' : '#5a4718'
    // keep showing your camera as a mirror; just say what's actually going out
    if (intermissionPreviewLabel) intermissionPreviewLabel.textContent = on ? 'your camera · audience sees the standby screen' : 'what your audience sees'
  }
  const stopIntermissionStatus = () => {
    if (this.intermissionStatusInterval) {
      clearInterval(this.intermissionStatusInterval)
      this.intermissionStatusInterval = null
    }
  }
  const clearIntermissionStatusLine = () => {
    stopIntermissionStatus()
    status.style.display = 'none'
    status.textContent = ''
    status.style.color = ''
  }
  const runIntermissionStatus = () => {
    stopIntermissionStatus()
    const render = () => {
      if (!this.intermission) {
        clearIntermissionStatusLine()
        return
      }
      const cd = this.intermissionCountdownLabel(this.intermission.until)
      status.style.display = 'block'
      status.style.color = '#f5b942'
      status.textContent = cd ? `${this.intermission.label} - ${cd}` : this.intermission.label
    }
    render()
    this.intermissionStatusInterval = setInterval(render, 1000)
  }
  intermissionBtn.onclick = () => {
    if (this.intermission) {
      this.dropIntermission()
      standbyStartLabel = false
      clearIntermissionStatusLine()
      syncIntermissionUi()
      return
    }
    // a mid-show break is always "be right back" -> "back to live", not a cold-open start
    standbyStartLabel = false
    this.openIntermissionPanel((label, untilMs) => {
      this.raiseIntermission(label, untilMs)
      syncIntermissionUi()
      runIntermissionStatus()
    })
  }

  // host quick-share: drop a screenshare onto a second screen for the room without walking to a mirror.
  // desktop only (screenshare is unreliable on phones), revealed once live alongside the intermission control.
  const shareScreenDockBtn = document.createElement('button')
  shareScreenDockBtn.type = 'button'
  shareScreenDockBtn.textContent = 'share a screen'
  Object.assign(shareScreenDockBtn.style, {
    display: 'none',
    background: 'transparent',
    color: '#f5b942',
    border: '1px solid #5a4718',
    padding: '6px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  })
  shareScreenDockBtn.onclick = () => this.openShareScreenChooser()

  const row = document.createElement('div')
  row.style.display = 'flex'
  row.style.gap = '0.5rem'
  row.append(intermissionBtn, shareScreenDockBtn, goBtn)

  // setup-only escape hatch: close the dialog without going live. hidden once streaming.
  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.textContent = 'cancel'
  Object.assign(cancelBtn.style, { background: 'transparent', color: '#888', border: '0', padding: '4px 0', cursor: 'pointer', fontFamily: 'inherit', fontSize: mobile ? '14px' : '12px', textDecoration: 'underline', flexShrink: '0' })
  cancelBtn.onclick = () => {
    if (this.broadcastChatDispose) {
      this.broadcastChatDispose()
      this.broadcastChatDispose = null
    }
    this.dismissBroadcastPanel()
  }

  // Mobile chat lives in the dock when live - bottom sheet covers world chat. Desktop uses normal chat.
  let chatSection: HTMLDivElement | null = null
  let chatRow: HTMLDivElement | null = null
  let chatReplyRow: HTMLDivElement | null = null
  let dockFooter: HTMLDivElement | null = null
  let renderDockChat: (() => void) | null = null
  if (mobile) {
    const chatLabel = document.createElement('label')
    chatLabel.textContent = 'chat'
    chatLabel.style.display = 'none'
    chatSection = document.createElement('div')
    Object.assign(chatSection.style, {
      flex: '1 1 0',
      minHeight: '0',
      overflowY: 'auto',
      background: '#1a1a1a',
      border: '1px solid #333',
      padding: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      fontSize: '14px',
      lineHeight: '1.4',
    })
    const chatMessages = document.createElement('div')
    Object.assign(chatMessages.style, { display: 'flex', flexDirection: 'column', gap: '4px' })
    chatSection.append(chatMessages)

    renderDockChat = () => {
      chatMessages.replaceChildren()
      const msgs = messageList.value.slice(-30)
      if (!msgs.length) {
        const empty = document.createElement('div')
        empty.style.color = '#888'
        empty.textContent = 'audience chat shows up here'
        chatMessages.append(empty)
        return
      }
      for (const m of msgs) {
        const { who: name, text } = chatLine(m)
        const line = document.createElement('div')
        const who = document.createElement('span')
        who.style.color = '#f5b942'
        who.style.fontWeight = 'bold'
        who.textContent = name + ': '
        const body = document.createElement('span')
        body.textContent = text
        line.append(who, body)
        chatMessages.append(line)
      }
      requestAnimationFrame(() => {
        chatSection!.scrollTop = chatSection!.scrollHeight
      })
    }

    // dispose any effect left from a previous open/cancel or it re-renders a detached panel forever
    this.broadcastChatDispose?.()
    this.broadcastChatDispose = effect(() => {
      messageList.value
      renderDockChat?.()
    })

    chatReplyRow = document.createElement('div')
    Object.assign(chatReplyRow.style, { display: 'flex', gap: '0.5rem' })
    const chatInput = document.createElement('input')
    chatInput.type = 'text'
    chatInput.placeholder = 'reply to chat'
    Object.assign(chatInput.style, {
      flex: '1',
      background: '#1a1a1a',
      color: '#f5f5f0',
      border: '1px solid #666',
      padding: '6px 8px',
      fontFamily: 'inherit',
      fontSize: '16px',
      height: '36px',
      boxSizing: 'border-box',
    })
    const chatSend = document.createElement('button')
    chatSend.textContent = 'send'
    Object.assign(chatSend.style, {
      background: '#333',
      color: '#f5f5f0',
      border: '0',
      padding: '6px 10px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      height: '36px',
      boxSizing: 'border-box',
      flexShrink: '0',
    })
    const sendDockChat = () => {
      const t = chatInput.value.trim()
      if (!t) return
      window.connector?.sendMessage(t)
      chatInput.value = ''
      chatInput.blur()
    }
    chatSend.onclick = sendDockChat
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        sendDockChat()
      }
    }
    chatReplyRow.append(chatInput, chatSend)
    chatReplyRow.style.display = 'none'
    Object.assign(chatReplyRow.style, {
      flexShrink: '0',
      paddingTop: '4px',
      borderTop: '1px solid #333',
    })

    // keyboard pushes fan link + stop under the fold - hide them while typing so send stays obvious
    let mobileChatComposing = false
    const setMobileChatComposing = (on: boolean) => {
      if (!this.broadcastRoom) return
      mobileChatComposing = on
      if (dockFooter) dockFooter.style.display = on ? 'none' : 'flex'
      if (mobileExtrasBtn) mobileExtrasBtn.style.display = on ? 'none' : 'block'
      if (flipBtn && !screenChk.checked) flipBtn.style.display = on ? 'none' : 'block'
      if (micToggle.style.display === 'block') micToggle.style.display = on ? 'none' : 'block'
      if (on) {
        Object.assign(chatReplyRow!.style, {
          position: 'sticky',
          bottom: '0',
          zIndex: '3',
          background: '#0d0d0d',
          paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        })
      } else {
        Object.assign(chatReplyRow!.style, { position: '', bottom: '', zIndex: '', background: '', paddingBottom: '' })
        if (chatReplyRow) chatReplyRow.style.paddingTop = '4px'
      }
    }
    const onMobileVpResize = () => {
      const vv = window.visualViewport
      if (!vv) return
      const inset = Math.max(0, window.innerHeight - vv.height)
      panel.style.paddingBottom = mobileChatComposing && inset > 48 ? `${inset}px` : ''
    }
    chatInput.addEventListener('focus', () => {
      setMobileChatComposing(true)
      onMobileVpResize()
      window.visualViewport?.addEventListener('resize', onMobileVpResize)
      requestAnimationFrame(() => chatInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    })
    chatInput.addEventListener('blur', () => {
      window.visualViewport?.removeEventListener('resize', onMobileVpResize)
      setTimeout(() => {
        if (document.activeElement === chatInput) return
        panel.style.paddingBottom = ''
        setMobileChatComposing(false)
      }, 150)
    })

    chatRow = document.createElement('div')
    Object.assign(chatRow.style, {
      display: 'none',
      flexDirection: 'column',
      gap: '4px',
      flex: '1 1 0',
      minHeight: '0',
      overflow: 'hidden',
    })
    chatRow.append(chatLabel, chatSection, chatReplyRow)

    dockFooter = document.createElement('div')
    Object.assign(dockFooter.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      flexShrink: '0',
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
    })
    if (shareRow) dockFooter.append(shareRow)
    dockFooter.append(row)

    const mobileKids: Node[] = [title]
    if (identityRow) mobileKids.push(identityRow)
    // mobile live uses flip camera link instead of "change camera or mic" (pick cam/mic before go-live in deviceRow)
    mobileKids.push(deviceRow, screenOpt, screenHint, standbyOpt, standbyConfig, flipBtn, micToggle, chatRow, dockFooter!, mobileExtrasBtn!, moveRow, status, cancelBtn)
    panel.append(...mobileKids)
  } else {
    const desktopKids: Node[] = [title]
    if (identityRow) desktopKids.push(identityRow)
    desktopKids.push(deviceRow, screenOpt, screenHint, standbyOpt, standbyConfig, deviceToggle, micToggle)
    if (shareRow) desktopKids.push(shareRow)
    desktopKids.push(moveRow, status, row, cancelBtn)
    panel.append(...desktopKids)
  }
  this.attachBroadcastPanel(panel)

  navigator.mediaDevices.enumerateDevices().then((devices) => {
    const cams = devices.filter((d) => d.kind === 'videoinput')
    const mics = devices.filter((d) => d.kind === 'audioinput')
    cams.forEach((d, i) => {
      const opt = document.createElement('option')
      opt.value = d.deviceId
      opt.textContent = d.label || `camera ${i + 1}`
      camSel.appendChild(opt)
    })
    mics.forEach((d, i) => {
      const opt = document.createElement('option')
      opt.value = d.deviceId
      opt.textContent = d.label || `mic ${i + 1}`
      micSel.appendChild(opt)
    })
  })

  // Live track refs + audio meter rewiring. Both updated on initial publish and on mid-stream device swap.
  let liveVideoTrack: any = null
  let liveAudioTrack: any = null
  let acquiredTracks: any[] | null = null
  let meterFillEl: HTMLDivElement | null = null
  const wireAudioMeter = (mst: MediaStreamTrack | undefined | null) => {
    if (this.audioMeterRaf) {
      cancelAnimationFrame(this.audioMeterRaf)
      this.audioMeterRaf = null
    }
    if (this.audioMeterCtx) {
      this.audioMeterCtx.close().catch(() => {})
      this.audioMeterCtx = null
    }
    if (!mst || !meterFillEl) return
    try {
      const ctx = new AudioContext()
      this.audioMeterCtx = ctx
      const source = ctx.createMediaStreamSource(new MediaStream([mst]))
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024 // finer bass resolution (~43Hz/bin) to catch the kick
      analyser.smoothingTimeConstant = 0.4 // less spectral smoothing so transients stay sharp
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const freq = new Uint8Array(analyser.frequencyBinCount)
      const avgBins = (arr: Uint8Array, lo: number, hi: number) => {
        let s = 0
        for (let i = lo; i < hi; i++) s += arr[i]
        return hi > lo ? s / (hi - lo) / 255 : 0
      }
      let bassAvg = 0
      let punchEnv = 0
      let lastTs = performance.now()
      const tick = () => {
        if (!meterFillEl) return
        // overall loudness (RMS of the waveform) - drives the meter bar
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const level = Math.min(1, Math.sqrt(sum / data.length) * 2)
        // frequency bands for the video FX (so the visuals dance, not just pulse)
        analyser.getByteFrequencyData(freq)
        const n = freq.length
        const bass = Math.min(1, avgBins(freq, 1, Math.max(2, (n * 0.02) | 0)) * 1.3)
        const mid = Math.min(1, avgBins(freq, Math.max(2, (n * 0.02) | 0), (n * 0.25) | 0) * 1.3)
        const treble = Math.min(1, avgBins(freq, (n * 0.25) | 0, (n * 0.6) | 0) * 1.6)
        // beat-punch = the bass TRANSIENT (how far bass jumps above its own slow average), auto-gained
        // so it snaps on kicks across loud AND quiet music instead of pinning to 1. time-based decay.
        const now = performance.now()
        const dt = Math.min(0.1, (now - lastTs) / 1000 || 0.016)
        lastTs = now
        bassAvg += (bass - bassAvg) * 0.06
        const transient = Math.min(1, Math.max(0, (bass - bassAvg) * 6))
        punchEnv = Math.max(transient, punchEnv * Math.exp(-dt / 0.12))
        this.fxAudio = { level, bass, mid, treble, punch: punchEnv }
        const pct = Math.min(100, level * 100)
        meterFillEl.style.width = pct + '%'
        meterFillEl.style.background = pct > 85 ? 'var(--red)' : pct > 60 ? '#f5b942' : '#22c55e'
        this.audioMeterRaf = requestAnimationFrame(tick)
      }
      tick()
    } catch {}
  }

  // Mid-stream device swaps via livekit setDeviceId - swaps underlying MediaStreamTrack on the existing publication, no renegotiate.
  // exact: a plain string is only an "ideal" hint, so the browser silently keeps the current cam; force the picked one.
  camSel.onchange = async () => {
    if (this.broadcastRoom && liveVideoTrack && camSel.value) {
      await liveVideoTrack.setDeviceId({ exact: camSel.value }).catch(() => {})
      this.syncBroadcastVideoFromTrack(liveVideoTrack)
    }
  }
  micSel.onchange = async () => {
    if (this.broadcastRoom && liveAudioTrack && micSel.value) {
      await liveAudioTrack.setDeviceId({ exact: micSel.value }).catch(() => {})
      wireAudioMeter(liveAudioTrack.mediaStreamTrack)
    }
  }

  goBtn.onclick = async () => {
    if (this.broadcastRoom) {
      if (mobile) {
        holdMobileCanvasRefresh(3000)
        if (!confirm('stop streaming?')) return
      }
      this.broadcastStopping = true
      this.cameraResumeGen++
      this.mobileBroadcastHooksClear?.()
      // stopping ends the show - close the dock entirely instead of bouncing back to the go-live form
      this.stopBroadcast()
      this.dismissBroadcastPanel()
      this.clearBroadcastDockUi()
      this.setPreview()
      return
    }

    // stream already ended but the dock is still open - dismiss, don't start a second go-live
    if (this.broadcastLost) {
      this.dismissBroadcastPanel()
      this.clearBroadcastDockUi()
      this.setPreview()
      return
    }

    // A showbox sticking out past the parcel only streams to people standing inside the parcel
    // (viewers connect on parcel-enter, not by proximity to the screen), and it still shows on the
    // homepage. Keep it honest: refuse to go live unless the whole screen is within parcel bounds.
    if (!this.withinBounds) {
      app.showSnackbar('move the showbox inside your parcel to go live', PanelType.Warning)
      return
    }

    // "open with a starting soon screen" - remember it so the live transition raises the card at once
    if (standbyChk.checked) {
      const mins = parseFloat(standbyMinInput.value)
      pendingStandby = { label: standbyMsgInput.value.trim() || 'starting soon', mins: !isNaN(mins) && mins > 0 ? mins : null }
    } else {
      pendingStandby = null
    }

    if (syntheticGuest) {
      const nextName = guestNameInput?.value.trim() || ''
      if (!nextName) {
        status.textContent = 'pick a name first'
        return
      }
      if (guestToken && nextName !== app.state.name) {
        status.textContent = 'saving name...'
        try {
          const r = await fetch(`/api/guest/${guestToken}/name`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: nextName }),
          })
          const j = await r.json()
          if (!j.success) throw new Error(j.error || 'failed')
          syncGuestDisplayName(nextName)
        } catch (e) {
          status.textContent = (e as Error)?.message || 'could not save name'
          return
        }
      } else if (guestToken) {
        syncGuestDisplayName(nextName)
      }
    }

    status.textContent = 'connecting...'
    goBtn.disabled = true
    this.viewerConnectGen++
    if (!this.isCohostMode() && this.livekitRoom) {
      this.livekitRoom.disconnect()
      this.livekitRoom = null
    }

    try {
      const tokenRes = await fetchShowboxRoomToken(showboxRoomTokenUrl(this.roomName(), true))
      const res = tokenRes
      if (!res?.token) {
        throw new Error(res?.error || 'could not get stream token - sign in again')
      }
      if (res.canPublish === false) {
        throw new Error('no permission to broadcast here - sign in as parcel owner or use a guest link')
      }
      saveShowboxPublisherIdentity(this.roomName(), res.token)

      // Acquire camera/screenshare BEFORE going live: the permission prompt can sit open for a while,
      // and we don't want the audience staring at "connecting..." for a stream that may never start.
      // Nothing is connected or flagged live yet, so a denial/cancel needs no teardown.
      let tracks: any[]
      try {
        if (screenChk.checked) {
          tracks = await createLocalScreenTracks({ audio: showboxAudioConstraints('external') })
        } else {
          tracks = await createLocalTracks({
            // exact: a plain string deviceId is only a preference, so 3-cam setups grab the wrong camera. Force the pick.
            video: cameraConstraints(camSel.value || undefined, mobile, 'portrait'),
            audio: showboxAudioConstraints(audioMode, micSel.value || undefined),
          })
        }
      } catch (err) {
        // empty message = silent reset (user cancelled the screenshare picker). camera errors get a plain-language nudge.
        throw new Error(screenChk.checked ? '' : cameraError(err, true))
      }
      acquiredTracks = tracks
      this.broadcastLiveTracks = tracks

      const videoTrack = tracks.find((t) => t.kind === Track.Kind.Video)
      if (!videoTrack) {
        throw new Error('showbox needs a camera or screenshare. for audio only, drop a Boombox instead.')
      }
      if (mobile && !screenChk.checked) {
        await videoTrack.restartTrack(mobileConstraints('user', 'portrait')).catch(() => {})
      }

      const room = new Room()
      this.broadcastRoom = room
      this.broadcastReconnectAttempts = 0
      this.broadcastReconnecting = false
      this.broadcastDisconnectStrikes = 0
      this.wireBroadcastRoom(room)

      // Hear the co-host ASAP. broadcastRoom is set first so their audio routes straight to a
      // monitor. If we were already watching them, flip that (spatial) audience audio to a
      // monitor now; otherwise connect the viewer room in parallel with our broadcast connect so
      // their audio lands with their video instead of seconds later.
      let viewerConnect: Promise<void> = Promise.resolve()
      if (this.isCohostMode()) {
        this.cohostLiveSince = Date.now()
        if (this.livekitRoom) {
          for (const audioEl of [...this.streamAudioEls]) {
            this.silenceAudioEl(audioEl)
            this.untrackStreamAudio(audioEl)
          }
          this.stopStreamVolumePoll()
          this.syncExistingCohostAudio()
        } else {
          this.setCohostConnecting()
          setTimeout(() => this.updateCohostComposite(), COHOST_CONNECT_GRACE_MS)
          viewerConnect = this.connectViewer()
        }
      }

      await room.connect(LIVEKIT_URL, res.token)
      this.parcel.sendStatePatch({ [this.uuid]: { live: 1 }, __showbox_live: this.uuid })

      for (const t of tracks) {
        await room.localParticipant.publishTrack(t)
      }
      this.liveStartedAt = Date.now()
      broadcastLiveStartedAt.value = this.liveStartedAt

      // mirror showboxes can't subscribe to our own feed (same client) - have them read it locally now
      this.parcel.getFeaturesByType('showbox').forEach((f) => (f as any).refreshMirrorVideo?.())

      if (!tracks.some((t) => t.kind === Track.Kind.Audio)) {
        status.textContent = 'live but no mic - check browser permissions'
      }

      liveVideoTrack = videoTrack
      liveAudioTrack = tracks.find((t) => t.kind === Track.Kind.Audio) ?? null
      this.broadcastLiveVideoTrack = liveVideoTrack
      this.broadcastLiveAudioTrack = liveAudioTrack
      this.wireCameraEndedListener(videoTrack)
      if (mobile) {
        const onVis = () => {
          if (document.visibilityState !== 'visible' || !this.broadcastRoom || this.broadcastStopping) return
          const brState = livekitRoomState(this.broadcastRoom)
          if (brState === 'disconnected') {
            void this.tryBroadcastReconnect('connection lost')
            return
          }
          if (brState === 'reconnecting') return
          if (this.broadcastCameraLost) {
            if (broadcastVideoTrackLive(this.broadcastRoom, liveVideoTrack)) {
              this.noteCameraHealthy(this.broadcastRoom)
              return
            }
            void this.tryResumeCamera()
            return
          }
          this.syncBroadcastVideoFromTrack(liveVideoTrack)
        }
        document.addEventListener('visibilitychange', onVis)
        clearMobileBroadcastHooks = () => {
          document.removeEventListener('visibilitychange', onVis)
          clearMobileBroadcastHooks = null
        }
        this.mobileBroadcastHooksClear = clearMobileBroadcastHooks
      }
      if (videoTrack) {
        const el = videoTrack.attach() as HTMLVideoElement
        el.muted = true
        el.playsInline = true
        el.setAttribute('playsinline', '')
        el.setAttribute('webkit-playsinline', 'true')
        if (this.isCohostMode()) {
          await viewerConnect
          this.wireLocalCohostVideo(el)
          this.syncExistingCohostVideos()
          this.updateCohostComposite()
          this.startThumbCapture()
        } else {
          this.localBroadcastVideoEl = el
          this.attachVideoToMesh(el, true)
          this.startThumbCapture(el)
        }
      }

      duckRadio(this)

      goBtn.textContent = 'stop streaming'
      goBtn.style.background = '#444'
      goBtn.disabled = false
      status.textContent = ''
      ;[title, screenOpt, standbyOpt, standbyConfig, status, cancelBtn].forEach((el) => ((el as HTMLElement).style.display = 'none'))
      // intermission control only makes sense once you're live
      intermissionBtn.style.display = 'block'
      // quick screen-share to a second screen - desktop only, and only while you're the one broadcasting
      if (!mobile) shareScreenDockBtn.style.display = 'block'
      if (pendingStandby) {
        // "open with a starting soon screen" - raise the card immediately so the raw camera never airs
        const { label, mins } = pendingStandby
        pendingStandby = null
        standbyStartLabel = true
        this.raiseIntermission(label, mins && mins > 0 ? Date.now() + mins * 60_000 : null)
      }
      syncIntermissionUi()
      if (this.intermission) runIntermissionStatus()
      if (identityRow) identityRow.style.display = 'none'
      deviceRow.style.display = 'none'
      // screensharing has no camera and the mic is handled by the mic toggle below - hide the device picker
      if (mobile) {
        deviceToggle.style.display = 'none'
      } else {
        deviceToggle.style.display = screenChk.checked ? 'none' : 'block'
        deviceToggle.textContent = 'change camera or mic'
      }
      if (screenChk.checked) {
        // cohost screenshare is a two-way conversation, so default the mic on. solo screenshare stays muted (usually video playback).
        micOn = this.isCohostMode()
        micToggle.style.display = 'block'
        syncMicToggle()
        if (micOn) {
          const micOpts = liveAudioTrack ? undefined : showboxAudioConstraints(audioMode, micSel.value || undefined)
          this.broadcastRoom.localParticipant.setMicrophoneEnabled(true, micOpts).catch(() => {
            micOn = false
            syncMicToggle()
          })
        }
      }
      if (mobile) {
        mobileExtrasOpen = false
        if (shareRow) shareRow.style.display = 'flex'
        moveRow.style.display = 'none'
        if (mobileExtrasBtn) mobileExtrasBtn.style.display = 'block'
        if (!screenChk.checked) {
          flipBtn.style.display = 'block'
          if (liveAudioTrack) {
            micOn = true
            micToggle.style.display = 'block'
            Object.assign(micToggle.style, {
              background: 'transparent',
              border: '0',
              padding: '4px 0',
              fontSize: '12px',
              textAlign: 'left',
              textDecoration: 'underline',
              minHeight: '0',
            })
            syncMicToggle()
          }
        }
      } else {
        if (shareRow) shareRow.style.display = 'flex'
        moveRow.style.display = 'flex'
        // fx mangles a screenshare and makes no sense there - drop the tab bar so only emote reactions show.
        if (fxTabs) fxTabs.style.display = screenChk.checked ? 'none' : 'flex'
        if (!screenChk.checked && liveAudioTrack) {
          micOn = true
          micToggle.style.display = 'block'
          syncMicToggle()
        }
      }
      if (chatRow) {
        chatRow.style.display = 'flex'
        chatRow.style.flex = '1 1 0'
        chatRow.style.minHeight = '0'
      }
      if (chatReplyRow) {
        chatReplyRow.style.display = 'flex'
        chatReplyRow.style.paddingTop = '4px'
      }
      if (dockFooter) Object.assign(dockFooter.style, { gap: '4px', paddingBottom: '0' })
      if (mobile) {
        goBtn.style.minHeight = '36px'
        goBtn.style.padding = '8px 12px'
      }
      mobileShowWorld = false

      panel.querySelectorAll('[data-showbox-dock-live-h]').forEach((n) => n.remove())
      panel.querySelectorAll('[data-showbox-dock-preview]').forEach((n) => n.remove())

      // live header: pulsing red dot + count-up timer so the broadcaster sees they are actually streaming.
      const liveHeader = document.createElement('div')
      liveHeader.dataset.dot = '1'
      liveHeader.dataset.showboxDockLiveH = '1'
      Object.assign(liveHeader.style, { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px' })
      const liveDot = document.createElement('span')
      liveDot.textContent = '\u25CF'
      Object.assign(liveDot.style, { animation: 'showbox-live-pulse 1.2s ease-in-out infinite' })
      const liveLabel = document.createElement('span')
      liveLabel.textContent = 'live'
      const liveTimer = document.createElement('span')
      Object.assign(liveTimer.style, { color: '#f5f5f0', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' })
      liveTimer.textContent = '0:00'
      liveHeader.append(liveDot, liveLabel)
      if (mobileWorldBtn) liveHeader.append(mobileWorldBtn)
      liveHeader.append(liveTimer)
      this.broadcastDockLiveDot = liveDot
      this.broadcastDockLiveLabel = liveLabel
      this.broadcastDockStatusEl = status
      this.broadcastLost = false

      // minimize is the close-X now: closing the sidebar while live drops to the pulsing
      // "live" edge tab (BroadcastSidebarTab) and clicking it brings the dock back.

      this.liveTimerInterval = setInterval(() => {
        if (!this.liveStartedAt) return
        const s = Math.floor((Date.now() - this.liveStartedAt) / 1000)
        const m = Math.floor(s / 60)
        const r = s % 60
        liveTimer.textContent = `${m}:${r.toString().padStart(2, '0')}`
      }, 1000)

      panel.insertBefore(liveHeader, panel.firstChild)

      if (videoTrack) {
        const meterTrack = document.createElement('div')
        Object.assign(meterTrack.style, { height: '5px', background: 'rgba(0,0,0,0.5)', flexShrink: '0' })
        const meterFill = document.createElement('div')
        Object.assign(meterFill.style, { width: '0%', height: '100%', background: '#22c55e', transition: 'width 60ms linear' })
        meterTrack.append(meterFill)
        meterFillEl = meterFill

        if (!mobile) {
          const previewWrap = document.createElement('div')
          previewWrap.dataset.dot = '1'
          previewWrap.dataset.showboxDockPreview = '1'
          // match the showbox orientation so a portrait composite shows whole, not cropped.
          // portrait is driven by a capped height (centered) so it doesn't dominate the panel.
          const portraitPreview = this.isPortraitScreen()
          Object.assign(previewWrap.style, {
            position: 'relative',
            background: '#000',
            overflow: 'hidden',
            aspectRatio: portraitPreview ? '9 / 16' : '16 / 9',
            ...(portraitPreview ? { height: '280px', margin: '0 auto' } : { width: '100%' }),
          })
          const previewVideo = this.isCohostMode() ? this.mountCohostPreviewVideo('cover') : makeDockPreviewVideo(videoTrack)
          if (!this.isCohostMode()) {
            previewVideo.volume = 0
            Object.assign(previewVideo.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' })
            fxSoloPreviewEl = previewVideo
          }
          const previewLabel = document.createElement('div')
          previewLabel.textContent = this.intermission ? 'your camera · audience sees the standby screen' : 'what your audience sees'
          Object.assign(previewLabel.style, { position: 'absolute', top: '4px', left: '6px', color: '#f5f5f0', fontSize: '11px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px' })
          intermissionPreviewLabel = previewLabel
          Object.assign(meterTrack.style, { position: 'absolute', bottom: '0', left: '0', right: '0' })
          previewWrap.append(previewVideo, previewLabel, meterTrack)
          panel.insertBefore(previewWrap, chatRow ?? moveRow)
          previewWrap.insertAdjacentElement('afterend', deviceToggle)
          deviceToggle.insertAdjacentElement('afterend', cameraReconnectBtn)
        } else {
          mobilePreviewWrap = document.createElement('div')
          mobilePreviewWrap.dataset.dot = '1'
          mobilePreviewWrap.dataset.showboxDockPreview = '1'
          Object.assign(mobilePreviewWrap.style, {
            position: 'relative',
            width: '100%',
            maxHeight: '18vh',
            minHeight: '80px',
            flexShrink: '0',
            background: '#000',
            overflow: 'hidden',
            aspectRatio: '9 / 16',
          })
          mobilePreviewVideo = this.isCohostMode() ? this.mountCohostPreviewVideo('contain') : makeDockPreviewVideo(videoTrack)
          this.mobilePreviewVideoEl = mobilePreviewVideo
          if (!this.isCohostMode()) mobilePreviewVideo.volume = 0
          syncMobilePreview = wirePreview(mobilePreviewWrap, mobilePreviewVideo, 'contain')
          this.syncMobilePreviewDock = syncMobilePreview
          const previewLabel = document.createElement('div')
          previewLabel.textContent = this.intermission ? 'your camera · audience sees the standby screen' : 'what your audience sees'
          Object.assign(previewLabel.style, { position: 'absolute', top: '4px', left: '6px', color: '#f5f5f0', fontSize: '11px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px' })
          intermissionPreviewLabel = previewLabel
          Object.assign(meterTrack.style, { position: 'absolute', bottom: '0', left: '0', right: '0' })
          mobilePreviewWrap.append(mobilePreviewVideo, previewLabel, meterTrack)
          panel.insertBefore(mobilePreviewWrap, chatRow ?? moveRow)
          mobilePreviewWrap.insertAdjacentElement('afterend', flipBtn)
          flipBtn.insertAdjacentElement('afterend', cameraReconnectBtn)
          syncVideoElFromTrack(mobilePreviewVideo, videoTrack)
          mobilePreviewVideo.play().catch(() => {})
          syncMobilePreview?.()

          mobileStreamHint = document.createElement('div')
          mobileStreamHint.dataset.dot = '1'
          mobileStreamHint.textContent = 'your stream is on the showbox above'
          Object.assign(mobileStreamHint.style, { display: 'none', color: '#888', fontSize: '12px', flexShrink: '0' })
          panel.insertBefore(mobileStreamHint, chatRow ?? moveRow)
        }

        if (this.isCohostMode()) this.updateCohostComposite()

        const audioMst = (liveAudioTrack as any)?.mediaStreamTrack as MediaStreamTrack | undefined
        if (audioMst) wireAudioMeter(audioMst)
        else meterTrack.remove()
      }

      setMobileDockLayout(true)
      setDesktopDockLayout(true)
      renderDockChat?.()
      this.announceLiveInChat()
      this.onViewerCountTick = (total) => {
        liveViewerCount = Math.max(0, total - 1)
        refreshMobileWorldBtn()
      }
      this.fetchViewerCount().then((total) => this.onViewerCountTick?.(total))
      this.startMilestonePoll()
    } catch (e) {
      clearMobileBroadcastHooks?.()
      status.textContent = e instanceof Error ? e.message : 'failed to connect'
      goBtn.disabled = false
      this.broadcastRoom?.disconnect()
      this.broadcastRoom = null
      for (const t of acquiredTracks ?? []) {
        try {
          t.stop()
        } catch {}
      }
      if (this.activeLiveShowboxUuid() === this.uuid) {
        try {
          this.parcel.sendStatePatch({ [this.uuid]: {}, __showbox_live: null })
        } catch {}
      }
    }
  }
}
