import { wantsAudio } from '../../../client/platform'
import { fetchShowboxRoomToken, LIVEKIT_URL } from '../../../client/broadcast/session'
import { unduckRadio } from '../../../web/src/radio/global'
import { Room, RoomEvent, Track } from 'livekit-client'
import { isRoomFullError, showboxRoomTokenUrl } from './context'
import type Showbox from './scene'

export async function connectViewer(this: Showbox) {
  if (this.livekitRoom || this.viewerConnecting) return
  const gen = ++this.viewerConnectGen
  this.viewerConnecting = true
  const res = await fetchShowboxRoomToken(showboxRoomTokenUrl(this.roomName()))
  if (!res?.token || this.disposed) {
    this.viewerConnecting = false
    if (this.needsViewerRoom()) this.scheduleViewerRetry()
    return
  }

  const room = new Room()
  this.livekitRoom = room
  this.wireViewerRoom(room)

  room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
    if (this.livekitRoom !== room) return
    const identity = participant?.identity ?? ''
    if (track.kind === Track.Kind.Video && this.isAngleTrackName(_pub?.trackName)) {
      if (this.isAngleMirror() && _pub.trackName === this.uuid) this.refreshAngleVideo()
      return // angle feeds only land on their matching mirror
    }
    if (this.broadcastRoom) {
      if (this.isCohostMode() && track.kind === Track.Kind.Audio && this.shouldPlayCohostAudio(identity)) {
        this.syncExistingCohostAudio()
        return
      }
      if (this.isCohostMode() && track.kind === Track.Kind.Video) {
        this.routeCohostVideo(track, identity)
        return
      }
      return
    }
    if (!this.streamTargetsThisShowbox()) {
      if (this.mirrorsActiveStream() && track.kind === Track.Kind.Video) this.scheduleMirrorRefresh()
      return
    }
    if (track.kind === Track.Kind.Audio) {
      if (!wantsAudio()) return
      const el = track.attach() as HTMLAudioElement
      el.style.display = 'none'
      document.body.appendChild(el)
      this.trackStreamAudio(el, identity)
      this.duckLive()
      this.startBroadcastAudio()
      return
    }
    if (track.kind === Track.Kind.Video) {
      if (this.isCohostMode()) {
        this.routeCohostVideo(track, identity)
      } else {
        const pick = this.pickVideoSource(false)
        if (pick) this.attachVideoToMesh(this.attachedVideoEl(pick.track), true)
      }
      this.startBroadcastAudio()
      this.stopStreamAttachRetry()
      this.refreshParcelMirrors()
    }
  })

  room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
    if (this.livekitRoom !== room) return
    const identity = participant?.identity ?? ''
    if (track.kind === Track.Kind.Video && this.isAngleTrackName(_pub?.trackName)) {
      if (this.isAngleMirror() && _pub.trackName === this.uuid) this.refreshAngleVideo()
      return
    }
    if (this.isMirror()) {
      if (track.kind === Track.Kind.Video) this.scheduleMirrorRefresh()
      return
    }
    if (this.broadcastRoom) {
      if (this.isCohostMode() && track.kind === Track.Kind.Audio) {
        track.detach().forEach((node) => {
          const i = this.cohostMonitorEls.indexOf(node as HTMLAudioElement)
          if (i >= 0) this.cohostMonitorEls.splice(i, 1)
        })
        return
      }
      if (this.isCohostMode() && track.kind === Track.Kind.Video) {
        this.clearCohostVideoForIdentity(identity)
        this.updateCohostComposite()
        return
      }
      return
    }
    if (track.kind === Track.Kind.Audio) {
      track.detach().forEach((node) => {
        this.untrackStreamAudio(node as HTMLAudioElement)
      })
      if (!this.streamAudioEls.length) {
        if (this.streamVolumeInterval) {
          clearInterval(this.streamVolumeInterval)
          this.streamVolumeInterval = null
        }
      }
      unduckRadio(this)
    }
    if (track.kind === Track.Kind.Video) {
      if (this.isCohostMode()) {
        this.clearCohostVideoForIdentity(identity)
        this.updateCohostComposite()
      } else {
        const pick = this.pickVideoSource(false)
        if (pick) {
          this.attachVideoToMesh(this.attachedVideoEl(pick.track), true)
        } else if (!this.hasRemoteBroadcaster()) {
          this.hasActiveVideo = false
          if (!this.broadcastRoom) this.setPreview()
        }
      }
      this.refreshParcelMirrors()
      return
    }
    if (!this.broadcastRoom && !this.hasActiveVideo) this.setPreview()
  })

  room.on(RoomEvent.AudioPlaybackStatusChanged, (playing) => {
    if (playing) {
      this.duckLive()
    } else {
      this.armGestureUnblock()
    }
  })

  room.on(RoomEvent.ParticipantConnected, () => {
    if (this.livekitRoom !== room) return
    if (this.broadcastRoom && this.isCohostMode()) {
      this.syncExistingCohostVideos()
      this.syncExistingCohostAudio()
      this.updateCohostComposite()
    } else if (!this.broadcastRoom) {
      this.tryAttachExistingStream()
    }
    this.setPreview()
  })
  room.on(RoomEvent.ParticipantDisconnected, () => {
    if (this.livekitRoom !== room) return
    if (this.isMirror()) {
      this.scheduleMirrorRefresh()
      return
    }
    if (this.isCohostMode()) {
      this.updateCohostComposite()
      this.ensureShowboxLiveFlag()
    }
    if (!this.hasActiveVideo) this.setPreview()
    this.refreshParcelMirrors()
  })

  try {
    await room.connect(LIVEKIT_URL, res.token)
    this.viewerRoomFull = false
    this.viewerReconnectAttempts = 0
    this.viewerDisconnectStrikes = 0
    this.viewerReconnecting = false
    this.stopViewerRetry()
  } catch (e) {
    room.disconnect()
    this.livekitRoom = null
    if (isRoomFullError(e)) {
      this.viewerRoomFull = true
    }
    if (this.needsViewerRoom()) this.scheduleViewerRetry()
  } finally {
    this.viewerConnecting = false
    if (gen !== this.viewerConnectGen) {
      if (this.livekitRoom !== room) room.disconnect()
      return
    }
    if (this.isCohostMode() && this.broadcastRoom && this.livekitRoom) {
      this.syncExistingCohostVideos()
      this.syncExistingCohostAudio()
      this.updateCohostComposite()
    }
    if (!this.isCohostMode() && this.broadcastRoom && this.livekitRoom) {
      this.livekitRoom.disconnect()
      this.livekitRoom = null
    }
    if (this.displaysStream() && !this.broadcastRoom) {
      this.tryAttachExistingStream()
      if (!this.hasActiveVideo) this.scheduleStreamAttachRetry()
    }
    this.setPreview()
  }
}
