import { Component, h } from 'preact'
import { decodeJwt } from 'jose'
import { isMobile } from '../../common/helpers/detector'
import { exitPointerLock } from '../../common/helpers/ui-helpers'
import { encodeCoords } from '../../common/helpers/utils'
import { ShowboxRecord } from '../../common/messages/feature'
import { Room, RoomEvent, Track, createLocalScreenTracks, createLocalTracks } from 'livekit-client'
import { app } from '../../web/src/state'
import { Position, Rotation, Scale, Script } from '../../web/src/components/editor'
import { Animations } from '../avatar-animations'
import { EmoteAnimation, Idle } from '../states'
import { cameraPosition, cameraRotation } from '../utils/camera'
import { Advanced, FeatureEditor, FeatureEditorProps, FeatureID, SetParentDropdown, Toolbar, UuidReadOnly } from '../ui/features'
import { FeatureMetadata, FeatureTemplate } from './_metadata'
import { Feature2D } from './feature'

// Quick-access subset for the broadcast dock. Full list lives in src/ui/interact/emote.tsx.
const DOCK_DANCES: Array<{ label: string; anim: Animations }> = [
  { label: 'dance', anim: Animations.Dance },
  { label: 'hype', anim: Animations.Hype },
  { label: 'clap', anim: Animations.Applause },
  { label: 'spin', anim: Animations.Spin },
  { label: 'savage', anim: Animations.Savage },
]
const DOCK_EMOJIS = ['🔥', '🙌', '❤️', '😂', '👏', '🎉']

const DEFAULT_VOLUME = 0.7
const MAX_VOLUME = 1
const LIVEKIT_URL = 'https://voxels-7pvk06qt.livekit.cloud'
const mobile = isMobile()

// True when the page was opened via /live/:token and the guest pass targets this showbox.
// The synthetic wallet `guest:*` and `?show=<uuid>` are both set by the server on redeem.
function isGuestForShowbox(uuid: string): boolean {
  const w = app.state.wallet
  if (!w || !w.startsWith('guest:')) return false
  try {
    return new URL(window.location.href).searchParams.get('show') === uuid
  } catch {
    return false
  }
}

function guestPassToken(): string | null {
  try {
    const key = app.state.key
    if (!key) return null
    const payload = decodeJwt(key) as { guest_pass?: string }
    return payload.guest_pass ?? null
  } catch {
    return null
  }
}

export default class Showbox extends Feature2D<ShowboxRecord> {
  static metadata: FeatureMetadata = {
    title: 'Showbox',
    subtitle: 'go live in the metaverse',
    type: 'showbox',
    image: '',
  }
  static template: FeatureTemplate = {
    type: 'showbox',
    scale: [2, 1, 0],
  }

  livekitRoom: Room | null = null
  broadcastRoom: Room | null = null
  broadcastPanel: HTMLDivElement | null = null
  thumbCanvas: HTMLCanvasElement | null = null
  thumbInterval: ReturnType<typeof setInterval> | null = null
  liveTimerInterval: ReturnType<typeof setInterval> | null = null
  liveStartedAt: number | null = null
  audioMeterRaf: number | null = null
  audioMeterCtx: AudioContext | null = null
  hasActiveVideo = false

  roomName() {
    return `parcel-${this.parcel.id}`
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
    return 1.2
  }

  get audio() {
    return window._audio
  }

  shouldBeInteractive(): boolean {
    return true
  }

  whatIsThis() {
    return <label>Live stream video and audio to anyone in the parcel.</label>
  }

  generate() {
    this.mesh = BABYLON.MeshBuilder.CreatePlane(this.uniqueEntityName('mesh'), { size: 1 }, this.scene)
    this.mesh.id = this.mesh.name + '/' + this.uuid
    this.setCommon()
    this.setPreview()
    if (this.isInCurrentParcel) {
      this.onEnter()
    }
    return Promise.resolve()
  }

  onEnter = () => {
    if (!this.livekitRoom) {
      this.connectViewer()
    }
    // Guest pass redirects with ?show=<uuid> - auto-open the broadcast dock so they don't have to find/click the panel.
    if (isGuestForShowbox(this.uuid) && !this.broadcastPanel) {
      setTimeout(() => this.openBroadcastPanel(), 250)
    }
  }

  onExit = () => {
    if (this.livekitRoom) {
      this.livekitRoom.disconnect()
      this.livekitRoom = null
      this.hasActiveVideo = false
      this.audio?.removeUserAudioReference(this)
    }
  }

  dispose() {
    this._dispose()
    this.livekitRoom?.disconnect()
    this.livekitRoom = null
    this.stopBroadcast(true)
    this.broadcastPanel?.remove()
    this.broadcastPanel = null
    this.audio?.removeUserAudioReference(this)
  }

  setPreview() {
    if (this.disposed) return
    if (this.hasActiveVideo) return
    const w = 640
    const h = 360
    const tex = new BABYLON.DynamicTexture(this.uniqueEntityName('texture'), { width: w, height: h }, this.scene, false)
    const ctx = tex.getContext() as CanvasRenderingContext2D
    const font = 'bold 18px "Source Code Pro", monospace'

    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, w, h)
    ctx.font = font
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f5f5f0'

    const hasRemoteBroadcaster = [...((this.livekitRoom as any)?.remoteParticipants?.values() ?? [])].some((p: any) => p?.videoTrackPublications?.size > 0 || p?.audioTrackPublications?.size > 0)

    if (hasRemoteBroadcaster) {
      ctx.fillStyle = '#888'
      ctx.fillText('connecting to stream...', w / 2, h / 2)
    } else if (this.parcel.canEdit || isGuestForShowbox(this.uuid)) {
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
    } else if (mobile && this.livekitRoom) {
      ctx.fillStyle = '#888'
      ctx.fillText('tap screen to listen', w / 2, h / 2)
    } else {
      ctx.fillStyle = '#888'
      ctx.fillText('no stream active', w / 2, h / 2)
    }

    tex.update()
    tex.hasAlpha = false

    const material = new BABYLON.StandardMaterial(this.uniqueEntityName('material'), this.scene)
    material.diffuseTexture = tex
    material.backFaceCulling = false
    material.zOffset = -4
    material.specularColor.set(0, 0, 0)
    material.emissiveColor.set(1, 1, 1)
    material.blockDirtyMechanism = true

    if (this.mesh) this.mesh.material = material
  }

  async connectViewer() {
    if (this.livekitRoom) return
    const res = await fetch(`/api/rooms/${this.roomName()}/token`)
      .then((r) => r.json())
      .catch(() => null)
    if (!res?.token || this.disposed) return

    const room = new Room()
    this.livekitRoom = room

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach() as HTMLAudioElement
        el.volume = this.volume
        el.style.display = 'none'
        document.body.appendChild(el)
        this.audio?.addUserAudioReference(this)
        this.startBroadcastAudio()
        return
      }
      if (track.kind === Track.Kind.Video) {
        this.attachVideoToMesh(track.attach() as HTMLVideoElement)
        this.startBroadcastAudio()
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        this.audio?.removeUserAudioReference(this)
      }
      if (track.kind === Track.Kind.Video) {
        this.hasActiveVideo = false
      }
      this.setPreview()
    })

    room.on(RoomEvent.AudioPlaybackStatusChanged, (playing) => {
      if (playing) {
        this.audio?.addUserAudioReference(this)
      } else {
        this.armGestureUnblock()
      }
    })

    room.on(RoomEvent.ParticipantConnected, () => this.setPreview())
    room.on(RoomEvent.ParticipantDisconnected, () => this.setPreview())

    await room.connect(LIVEKIT_URL, res.token).catch(() => null)
    this.setPreview()
  }

  startBroadcastAudio() {
    if (!this.livekitRoom) return
    this.livekitRoom.startAudio().catch(() => {})
    this.audio?.addUserAudioReference(this)
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

  attachVideoToMesh(el: HTMLVideoElement, muted = false) {
    if (!this.mesh) return
    el.muted = muted
    el.autoplay = true
    el.play().catch(() => {})

    this.hasActiveVideo = true
    const tex = new BABYLON.VideoTexture(this.uniqueEntityName('texture'), el, this.scene, false, false)
    tex.hasAlpha = false

    const mat = new BABYLON.StandardMaterial(this.uniqueEntityName('material'), this.scene)
    mat.diffuseTexture = tex
    mat.backFaceCulling = false
    mat.zOffset = -4
    mat.specularColor.set(0, 0, 0)
    mat.emissiveColor.set(1, 1, 1)
    mat.blockDirtyMechanism = true

    this.mesh.material = mat
  }

  startThumbCapture(videoEl: HTMLVideoElement) {
    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement('canvas')
      this.thumbCanvas.width = 256
      this.thumbCanvas.height = 144
    }
    const canvas = this.thumbCanvas
    const ctx = canvas.getContext('2d')!
    const room = this.roomName()
    const id = this.parcel.id
    const parcel = { id, name: this.parcel.name, address: this.parcel.address }
    this.thumbInterval = setInterval(() => {
      try {
        ctx.drawImage(videoEl, 0, 0, 256, 144)
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

  stopBroadcast(silent = false) {
    this.stopThumbCapture(silent)
    this.broadcastRoom?.disconnect()
    this.broadcastRoom = null
    this.hasActiveVideo = false
    this.audio?.removeUserAudioReference(this)
    if (this.liveTimerInterval) {
      clearInterval(this.liveTimerInterval)
      this.liveTimerInterval = null
    }
    this.liveStartedAt = null
    if (this.audioMeterRaf) {
      cancelAnimationFrame(this.audioMeterRaf)
      this.audioMeterRaf = null
    }
    if (this.audioMeterCtx) {
      this.audioMeterCtx.close().catch(() => {})
      this.audioMeterCtx = null
    }
  }

  openBroadcastPanel() {
    if (this.broadcastPanel) {
      this.broadcastPanel.remove()
      this.broadcastPanel = null
      this.stopBroadcast()
      return
    }

    exitPointerLock()

    // Audience share url - a regular voxels /play coords link that lands right next to the showbox.
    // No special query params; viewers just walk into the parcel and see/hear the stream.
    const showPos = this.absolutePosition ?? new BABYLON.Vector3((this.parcel.x1 + this.parcel.x2) / 2, this.parcel.y1, (this.parcel.z1 + this.parcel.z2) / 2)
    const showCoords = encodeCoords({ position: showPos, rotation: new BABYLON.Vector3(0, 0, 0) })
    const showUrl = `${window.location.origin}/play?coords=${encodeURIComponent(showCoords)}`

    const panel = document.createElement('div')
    this.broadcastPanel = panel
    // Same DOM structure for desktop + mobile, just different container shape:
    // desktop = 340px right-side dock; mobile = full-screen takeover.
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
        gap: '0.75rem',
        overflowY: 'auto',
        fontFamily: '"Source Code Pro", monospace',
        fontSize: '15px',
      })
    } else {
      Object.assign(panel.style, {
        position: 'fixed',
        zIndex: '999999',
        top: '12px',
        right: '12px',
        background: '#0d0d0d',
        color: '#f5f5f0',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        width: '340px',
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
        fontFamily: '"Source Code Pro", monospace',
        fontSize: '13px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      })
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

    const screenOpt = document.createElement('label')
    const screenChk = document.createElement('input')
    screenChk.type = 'checkbox'
    screenOpt.append(screenChk, ' use screenshare instead of camera')
    if (mobile) screenOpt.style.display = 'none' // screenshare from a phone is unreliable; stick to the camera

    // Identity row. Owners use their voxels profile. Guests pick their own name here before going live.
    const isGuest = isGuestForShowbox(this.uuid)
    const guestToken = isGuest ? guestPassToken() : null
    let guestNameInput: HTMLInputElement | null = null

    const identityRow = document.createElement('div')
    Object.assign(identityRow.style, { display: 'flex', flexDirection: 'column', gap: '4px' })
    const identityLabel = document.createElement('label')
    identityLabel.textContent = isGuest ? 'Name' : 'streaming as'
    if (isGuest && guestToken) {
      const nameInput = document.createElement('input')
      guestNameInput = nameInput
      nameInput.type = 'text'
      nameInput.value = app.state.name ?? ''
      nameInput.placeholder = 'e.g. DJ ANON'
      nameInput.maxLength = 64
      Object.assign(nameInput.style, { width: '100%', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: '8px', fontFamily: 'inherit', minHeight: '36px', boxSizing: 'border-box' })
      const nameStatus = document.createElement('small')
      nameStatus.style.color = '#888'
      let saveTimer: ReturnType<typeof setTimeout> | null = null
      const save = async () => {
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
          app.setName(next)
          nameStatus.textContent = 'saved'
          setTimeout(() => (nameStatus.textContent = ''), 1500)
        } catch {
          nameStatus.textContent = 'could not save'
        }
      }
      nameInput.oninput = () => {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(save, 600)
      }
      nameInput.onblur = save
      identityRow.append(identityLabel, nameInput, nameStatus)
    } else {
      const nameDisplay = document.createElement('div')
      nameDisplay.textContent = app.state.name ?? '(set your name in your voxels profile)'
      Object.assign(nameDisplay.style, { background: '#1a1a1a', border: '1px solid #333', padding: '8px', color: '#f5f5f0', minHeight: '36px', boxSizing: 'border-box', display: 'flex', alignItems: 'center' })
      identityRow.append(identityLabel, nameDisplay)
    }

    // share row - shown only once the broadcaster is actually live. Before going live it's noise;
    // after going live they want to drop the link on x / instagram to pull people in.
    const shareRow = document.createElement('div')
    Object.assign(shareRow.style, { display: 'none', flexDirection: 'column', gap: '4px', borderTop: '1px solid #222', borderBottom: '1px solid #222', padding: '8px 0' })
    const shareLabel = document.createElement('label')
    shareLabel.textContent = 'show link'
    shareLabel.style.color = '#888'
    const shareInput = document.createElement('input')
    shareInput.type = 'text'
    shareInput.readOnly = true
    shareInput.value = showUrl
    Object.assign(shareInput.style, { width: '100%', background: '#1a1a1a', color: '#f5f5f0', border: '1px solid #333', padding: '8px', fontFamily: 'inherit', minHeight: '36px' })
    shareInput.onclick = () => shareInput.select()
    const shareBtnRow = document.createElement('div')
    Object.assign(shareBtnRow.style, { display: 'flex', gap: '0.5rem' })
    const copyBtn = document.createElement('button')
    copyBtn.textContent = 'copy'
    Object.assign(copyBtn.style, { background: '#333', color: '#f5f5f0', border: '0', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', minHeight: '36px' })
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(showUrl).catch(() => {})
      copyBtn.textContent = 'copied'
      setTimeout(() => (copyBtn.textContent = 'copy'), 1500)
    }
    const xBtn = document.createElement('button')
    xBtn.textContent = 'post on x'
    Object.assign(xBtn.style, { background: '#333', color: '#f5f5f0', border: '0', padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', minHeight: '36px' })
    xBtn.onclick = () => {
      const text = `going live in voxels - ${showUrl}`
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    }
    shareBtnRow.append(copyBtn, xBtn)
    shareRow.append(shareLabel, shareInput, shareBtnRow)

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
      persona.popState(controls)
      if (anim) persona.setState({ state: new EmoteAnimation(anim) }, controls)
      else persona.setState({ state: new Idle() }, controls)
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
    moveRow.append(danceRow, emojiRow)

    const status = document.createElement('div')
    status.style.color = '#888'

    const goBtn = document.createElement('button')
    goBtn.textContent = 'go live'
    Object.assign(goBtn.style, { background: '#dc1e1e', color: '#f5f5f0', border: '0', padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit', flex: '2', minHeight: '44px', fontWeight: 'bold' })

    const closeBtn = document.createElement('button')
    closeBtn.textContent = 'close'
    Object.assign(closeBtn.style, { background: '#333', color: '#f5f5f0', border: '0', padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit', flex: '1', minHeight: '44px' })
    closeBtn.onclick = () => {
      panel.remove()
      this.broadcastPanel = null
      this.stopBroadcast()
    }

    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.gap = '0.5rem'
    row.append(goBtn, closeBtn)

    panel.append(title, identityRow, camLabel, camSel, micLabel, micSel, screenOpt, shareRow, moveRow, status, row)
    document.body.appendChild(panel)

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
        analyser.fftSize = 512
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          if (!meterFillEl) return
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const pct = Math.min(100, Math.sqrt(sum / data.length) * 200)
          meterFillEl.style.width = pct + '%'
          meterFillEl.style.background = pct > 85 ? '#dc1e1e' : pct > 60 ? '#f5b942' : '#22c55e'
          this.audioMeterRaf = requestAnimationFrame(tick)
        }
        tick()
      } catch {}
    }

    // Mid-stream device swaps via livekit setDeviceId - swaps underlying MediaStreamTrack on the existing publication, no renegotiate.
    camSel.onchange = async () => {
      if (this.broadcastRoom && liveVideoTrack && camSel.value) {
        await liveVideoTrack.setDeviceId(camSel.value).catch(() => {})
      }
    }
    micSel.onchange = async () => {
      if (this.broadcastRoom && liveAudioTrack && micSel.value) {
        await liveAudioTrack.setDeviceId(micSel.value).catch(() => {})
        wireAudioMeter(liveAudioTrack.mediaStreamTrack)
      }
    }

    goBtn.onclick = async () => {
      if (this.broadcastRoom) {
        this.stopBroadcast()
        liveVideoTrack = null
        liveAudioTrack = null
        meterFillEl = null
        goBtn.textContent = 'go live'
        goBtn.style.background = '#dc1e1e'
        this.setPreview()
        panel.querySelectorAll('[data-dot]').forEach((el) => el.remove())
        if (this.liveTimerInterval) {
          clearInterval(this.liveTimerInterval)
          this.liveTimerInterval = null
        }
        this.liveStartedAt = null
        ;[title, identityRow, screenOpt, status].forEach((el) => ((el as HTMLElement).style.display = ''))
        shareRow.style.display = 'none'
        moveRow.style.display = 'none'
        return
      }

      if (isGuest) {
        const nextName = guestNameInput?.value.trim() || app.state.name?.trim() || ''
        if (!nextName) {
          status.textContent = 'pick a name on stream first'
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
            app.setName(nextName)
          } catch {
            status.textContent = 'could not save name'
            return
          }
        }
      }

      status.textContent = 'connecting...'
      goBtn.disabled = true

      try {
        const id = this.parcel.id
        const res = await fetch(`/api/rooms/${this.roomName()}/token`).then((r) => r.json())
        if (!res?.token) throw new Error('no token')

        const room = new Room()
        this.broadcastRoom = room
        await room.connect(LIVEKIT_URL, res.token)

        let tracks: any[]
        if (screenChk.checked) {
          tracks = await createLocalScreenTracks({ audio: true })
        } else {
          tracks = await createLocalTracks({
            video: { deviceId: camSel.value || undefined },
            audio: { deviceId: micSel.value || undefined },
          })
        }

        for (const t of tracks) {
          await room.localParticipant.publishTrack(t)
        }

        if (!tracks.some((t) => t.kind === Track.Kind.Audio)) {
          status.textContent = 'live but no mic - check browser permissions'
        }

        const videoTrack = tracks.find((t) => t.kind === Track.Kind.Video)
        liveVideoTrack = videoTrack ?? null
        liveAudioTrack = tracks.find((t) => t.kind === Track.Kind.Audio) ?? null
        if (videoTrack) {
          const el = videoTrack.attach() as HTMLVideoElement
          this.attachVideoToMesh(el, true)
          this.startThumbCapture(el)
        }

        this.audio?.addUserAudioReference(this)

        goBtn.textContent = 'stop streaming'
        goBtn.style.background = '#444'
        goBtn.disabled = false
        status.textContent = ''
        ;[title, identityRow, screenOpt, status].forEach((el) => ((el as HTMLElement).style.display = 'none'))
        shareRow.style.display = 'flex'
        moveRow.style.display = 'flex'

        // live header: pulsing red dot + count-up timer so the broadcaster sees they are actually streaming.
        const liveHeader = document.createElement('div')
        liveHeader.dataset.dot = '1'
        Object.assign(liveHeader.style, { display: 'flex', alignItems: 'center', gap: '8px', color: '#dc1e1e', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px' })
        const liveDot = document.createElement('span')
        liveDot.textContent = '\u25CF'
        Object.assign(liveDot.style, { animation: 'showbox-live-pulse 1.2s ease-in-out infinite' })
        const liveLabel = document.createElement('span')
        liveLabel.textContent = 'live'
        const liveTimer = document.createElement('span')
        Object.assign(liveTimer.style, { color: '#f5f5f0', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' })
        liveTimer.textContent = '0:00'
        liveHeader.append(liveDot, liveLabel, liveTimer)

        if (!document.getElementById('showbox-live-pulse-style')) {
          const styleEl = document.createElement('style')
          styleEl.id = 'showbox-live-pulse-style'
          styleEl.textContent = '@keyframes showbox-live-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }'
          document.head.appendChild(styleEl)
        }

        this.liveStartedAt = Date.now()
        this.liveTimerInterval = setInterval(() => {
          if (!this.liveStartedAt) return
          const s = Math.floor((Date.now() - this.liveStartedAt) / 1000)
          const m = Math.floor(s / 60)
          const r = s % 60
          liveTimer.textContent = `${m}:${r.toString().padStart(2, '0')}`
        }, 1000)

        // Self-preview video so the broadcaster can see exactly what the audience sees on the showbox.
        // Also doubles as a "yes, your camera/screen is actually being streamed" confirmation.
        if (videoTrack) {
          const previewWrap = document.createElement('div')
          previewWrap.dataset.dot = '1'
          Object.assign(previewWrap.style, { position: 'relative', width: '100%', aspectRatio: mobile ? '9 / 16' : '16 / 9', maxHeight: mobile ? '50vh' : 'none', background: '#000', overflow: 'hidden' })
          const previewVideo = videoTrack.attach() as HTMLVideoElement
          previewVideo.muted = true // critical - never echo the broadcaster's own voice back at them
          previewVideo.volume = 0
          previewVideo.playsInline = true
          // Desktop cams are landscape (cover crops slightly) - mobile cams are usually portrait
          // (contain avoids cropping the broadcaster's face).
          Object.assign(previewVideo.style, { width: '100%', height: '100%', objectFit: mobile ? 'contain' : 'cover', display: 'block' })
          const previewLabel = document.createElement('div')
          previewLabel.textContent = 'what your audience sees'
          Object.assign(previewLabel.style, { position: 'absolute', top: '4px', left: '6px', color: '#f5f5f0', fontSize: '11px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px' })

          // Audio meter overlay: thin bar at the bottom of the preview that pulses with mic input.
          // Tells the broadcaster their mic is actually picking up sound without needing to hear themselves.
          const meterTrack = document.createElement('div')
          Object.assign(meterTrack.style, { position: 'absolute', bottom: '0', left: '0', right: '0', height: '5px', background: 'rgba(0,0,0,0.5)' })
          const meterFill = document.createElement('div')
          Object.assign(meterFill.style, { width: '0%', height: '100%', background: '#22c55e', transition: 'width 60ms linear' })
          meterTrack.append(meterFill)
          previewWrap.append(previewVideo, previewLabel, meterTrack)
          panel.insertBefore(previewWrap, moveRow)

          meterFillEl = meterFill
          const audioMst = (liveAudioTrack as any)?.mediaStreamTrack as MediaStreamTrack | undefined
          if (audioMst) wireAudioMeter(audioMst)
          else meterTrack.remove()
        }

        panel.insertBefore(liveHeader, panel.firstChild)
      } catch {
        status.textContent = 'failed to connect'
        goBtn.disabled = false
        this.broadcastRoom = null
      }
    }
  }

  onClick() {
    if (!this.broadcastRoom) {
      const hasRemoteBroadcaster = [...((this.livekitRoom as any)?.remoteParticipants?.values() ?? [])].some((p: any) => p?.videoTrackPublications?.size > 0 || p?.audioTrackPublications?.size > 0)
      if ((this.parcel.canEdit || isGuestForShowbox(this.uuid)) && !hasRemoteBroadcaster) {
        this.openBroadcastPanel()
      } else {
        this.startBroadcastAudio()
      }
    }
    this.parcelScript?.dispatch('click', this, {})
  }
}

class Editor extends FeatureEditor<Showbox> {
  constructor(props: FeatureEditorProps<Showbox>) {
    super(props)
    this.state = {
      id: props.feature.description.id,
      rolloffFactor: props.feature.rolloffFactor,
      volume: props.feature.volume,
    }
  }

  componentDidUpdate() {
    this.merge({
      rolloffFactor: this.state.rolloffFactor,
      volume: this.state.volume,
    })
  }

  render() {
    return (
      <section>
        <header>
          <h2>Edit Showbox</h2>
          <button onClick={this.onBackClick} class="close">
            <span>&times;</span>
          </button>
        </header>
        <div className="scrollContainer">
          <Toolbar feature={this.props.feature} scene={this.props.scene} />
          <Position feature={this.props.feature} key={this.props.feature.position.toString()} />
          <Scale feature={this.props.feature} key={this.props.feature.scale.toString()} />
          <Rotation feature={this.props.feature} key={this.props.feature.rotation.toString()} />
          <GuestPasses feature={this.props.feature} />
          <Advanced>
            <FeatureID feature={this.props.feature} />
            <SetParentDropdown feature={this.props.feature} />
            <div className="f">
              <label>Spatial Rolloff Factor</label>
              <input type="range" step="0.1" min="0" max="5" value={this.state.rolloffFactor} onChange={(e) => this.setState({ rolloffFactor: parseFloat(e.currentTarget.value) })} />
              <small>How quickly sound fades as players move away</small>
            </div>
            <div className="f">
              <label>Volume</label>
              <input type="range" step="0.01" min="0" max={MAX_VOLUME} value={this.state.volume} onChange={(e) => this.setState({ volume: parseFloat(e.currentTarget.value) })} />
            </div>
            <UuidReadOnly feature={this.props.feature} />
            <Script feature={this.props.feature} />
          </Advanced>
        </div>
      </section>
    )
  }
}

Showbox.Editor = Editor

// Owner-facing panel inside the Showbox editor. Create/list/revoke guest pass links
// that let an invited broadcaster (artist, speaker, DJ) go live on this showbox without an account.
type Pass = { token: string; parcel_id: number; feature_uuid: string; name: string; created_at: string; revoked_at: string | null }

class GuestPasses extends Component<{ feature: Showbox }, { passes: Pass[]; loading: boolean; creating: boolean; error: string | null }> {
  state = { passes: [] as Pass[], loading: true, creating: false, error: null as string | null }

  componentDidMount() {
    this.refresh()
  }

  parcelId() {
    return this.props.feature.parcel.id
  }

  featureUuid() {
    return this.props.feature.uuid
  }

  async refresh() {
    try {
      const r = await fetch(`/api/parcels/${this.parcelId()}/guest-passes`, { credentials: 'include' })
      const j = await r.json()
      const all: Pass[] = j.passes ?? []
      this.setState({ passes: all.filter((p) => p.feature_uuid === this.featureUuid()), loading: false })
    } catch {
      this.setState({ loading: false })
    }
  }

  async create() {
    this.setState({ creating: true, error: null })
    try {
      const r = await fetch(`/api/parcels/${this.parcelId()}/guest-passes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ feature_uuid: this.featureUuid() }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.error || 'Could not create link')
      await this.refresh()
    } catch (e: any) {
      this.setState({ error: e?.message ?? 'Could not create link' })
    } finally {
      this.setState({ creating: false })
    }
  }

  async revoke(token: string) {
    if (!confirm('Revoke this link? They will be kicked if currently live.')) return
    await fetch(`/api/parcels/${this.parcelId()}/guest-passes/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {})
    await this.refresh()
  }

  copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  liveUrl(token: string) {
    return `${window.location.origin}/live/${token}`
  }

  showUrl() {
    const f = this.props.feature
    const pos = f.absolutePosition ?? new BABYLON.Vector3((f.parcel.x1 + f.parcel.x2) / 2, f.parcel.y1, (f.parcel.z1 + f.parcel.z2) / 2)
    const coords = encodeCoords({ position: pos, rotation: new BABYLON.Vector3(0, 0, 0) })
    return `${window.location.origin}/play?coords=${encodeURIComponent(coords)}`
  }

  render() {
    if (!this.props.feature.parcel.canEdit) return null
    const active = this.state.passes.filter((p) => !p.revoked_at)
    const revoked = this.state.passes.filter((p) => p.revoked_at)

    return (
      <div className="f">
        <label>Guest broadcast links</label>
        <small>One-tap broadcast link for someone without a voxels account - artists, speakers, anyone you invite. They pick their own name when they open the link. No voxels account needed.</small>

        <div className="f">
          <label>share-with-audience show link</label>
          <input type="text" readOnly value={this.showUrl()} onClick={(e) => (e.currentTarget as HTMLInputElement).select()} />
          <small>Post on socials. Drops viewers in front of this showbox.</small>
        </div>

        <div className="f">
          <button onClick={() => this.create()} disabled={this.state.creating}>
            {this.state.creating ? 'creating...' : 'create link'}
          </button>
          {this.state.error && <div style={{ color: '#dc1e1e' }}>{this.state.error}</div>}
        </div>

        {this.state.loading && <small>loading...</small>}

        {active.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {active.map((p) => (
                <tr key={p.token}>
                  <td>
                    <strong>{p.name?.trim() || 'name not chosen yet'}</strong>
                    <br />
                    <input type="text" readOnly value={this.liveUrl(p.token)} onClick={(e) => (e.currentTarget as HTMLInputElement).select()} style={{ width: '100%' }} />
                  </td>
                  <td style={{ verticalAlign: 'top' }}>
                    <button onClick={() => this.copy(this.liveUrl(p.token))}>copy</button>
                    <button onClick={() => this.revoke(p.token)}>revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {revoked.length > 0 && (
          <details>
            <summary>{revoked.length} revoked</summary>
            <ul>
              {revoked.map((p) => (
                <li key={p.token}>
                  <small>
                    {p.name} - revoked {new Date(p.revoked_at!).toLocaleDateString()}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }
}
