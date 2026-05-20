import { h } from 'preact'
import { isMobile } from '../../common/helpers/detector'
import { exitPointerLock } from '../../common/helpers/ui-helpers'
import { encodeCoords } from '../../common/helpers/utils'
import { ShowboxRecord } from '../../common/messages/feature'
import { Room, RoomEvent, Track, createLocalScreenTracks, createLocalTracks } from 'livekit-client'
import { app } from '../../web/src/state'
import { Position, Rotation, Scale, Script } from '../../web/src/components/editor'
import { cameraPosition, cameraRotation } from '../utils/camera'
import { Advanced, FeatureEditor, FeatureEditorProps, FeatureID, SetParentDropdown, Toolbar, UuidReadOnly } from '../ui/features'
import { FeatureMetadata, FeatureTemplate } from './_metadata'
import { Feature2D } from './feature'

const DEFAULT_VOLUME = 0.7
const MAX_VOLUME = 1
const LIVEKIT_URL = 'https://voxels-7pvk06qt.livekit.cloud'
const mobile = isMobile()

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
  }

  onExit = () => {
    if (this.livekitRoom) {
      this.livekitRoom.disconnect()
      this.livekitRoom = null
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

    if (this.parcel.canEdit) {
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
      this.setPreview()
    })

    room.on(RoomEvent.AudioPlaybackStatusChanged, (playing) => {
      if (playing) {
        this.audio?.addUserAudioReference(this)
      } else {
        this.armGestureUnblock()
      }
    })

    await room.connect(LIVEKIT_URL, res.token).catch(() => null)
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
    this.audio?.removeUserAudioReference(this)
  }

  openBroadcastPanel() {
    if (this.broadcastPanel) {
      this.broadcastPanel.remove()
      this.broadcastPanel = null
      this.stopBroadcast()
      return
    }

    exitPointerLock()

    const panel = document.createElement('div')
    this.broadcastPanel = panel
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '999999',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#0d0d0d',
      color: '#f5f5f0',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      minWidth: '320px',
      fontFamily: '"Source Code Pro", monospace',
      fontSize: '13px',
    })

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

    const status = document.createElement('div')
    status.style.color = '#888'

    const goBtn = document.createElement('button')
    goBtn.textContent = 'go live'
    Object.assign(goBtn.style, { background: '#dc1e1e', color: '#f5f5f0', border: '0', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' })

    const closeBtn = document.createElement('button')
    closeBtn.textContent = 'close'
    Object.assign(closeBtn.style, { background: '#333', color: '#f5f5f0', border: '0', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' })
    closeBtn.onclick = () => {
      panel.remove()
      this.broadcastPanel = null
      this.stopBroadcast()
    }

    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.gap = '0.5rem'
    row.append(goBtn, closeBtn)

    panel.append(title, camLabel, camSel, micLabel, micSel, screenOpt, status, row)
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

    goBtn.onclick = async () => {
      if (this.broadcastRoom) {
        this.stopBroadcast()
        goBtn.textContent = 'go live'
        this.setPreview()
        panel.querySelector('span[data-dot]')?.remove()
        ;[title, camLabel, camSel, micLabel, micSel, screenOpt, status].forEach((el) => ((el as HTMLElement).style.display = ''))
        Object.assign(panel.style, {
          top: '50%',
          left: '50%',
          right: 'auto',
          transform: 'translate(-50%, -50%)',
          padding: '1rem',
          minWidth: '320px',
          flexDirection: 'column',
          borderRadius: '0',
        })
        return
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
        if (videoTrack) {
          const el = videoTrack.attach() as HTMLVideoElement
          this.attachVideoToMesh(el, true)
          this.startThumbCapture(el)
        }

        this.audio?.addUserAudioReference(this)

        goBtn.textContent = 'stop'
        goBtn.disabled = false
        status.textContent = ''
        ;[title, camLabel, camSel, micLabel, micSel, screenOpt, status].forEach((el) => ((el as HTMLElement).style.display = 'none'))
        Object.assign(panel.style, {
          top: '12px',
          left: 'auto',
          right: '12px',
          transform: 'none',
          padding: '6px 10px',
          minWidth: 'unset',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px',
          borderRadius: '999px',
        })
        const dot = document.createElement('span')
        dot.dataset.dot = '1'
        dot.textContent = '\u25CF live'
        dot.style.color = '#dc1e1e'
        dot.style.fontWeight = 'bold'
        panel.insertBefore(dot, row)
      } catch {
        status.textContent = 'failed to connect'
        goBtn.disabled = false
        this.broadcastRoom = null
      }
    }
  }

  onClick() {
    if (!this.broadcastRoom) {
      if (this.parcel.canEdit && !(this.livekitRoom as any)?.remoteParticipants?.size) {
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
