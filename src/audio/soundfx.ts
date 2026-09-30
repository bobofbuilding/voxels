const SOUNDS_URL = process.env.SOUNDS_URL!

interface SoundInfo {
  url: string
  options: BABYLON.ISoundOptions
  sound?: BABYLON.Sound
}

// avatar sounds come from other players and should be spatial
type AvatarSound = 'avatar.arrive' | 'avatar.leave' | 'avatar.chat' | 'avatar.emote'

type BuildSound = 'build.place' | 'build.extend' | 'build.select' | 'build.start'

export type SoundName = AvatarSound | BuildSound

const alertOptions = {
  spatialSound: false,
  loop: false,
  autoplay: false,
}
const spatialOptions = {
  rolloffFactor: 2,
  maxDistance: 24,
  spatialSound: true,
  loop: false,
  autoplay: false,
}

const url = (path: string) => SOUNDS_URL + (path.startsWith('/') ? path : `/${path}`)

export const soundFx: Record<SoundName, SoundInfo> = {
  'avatar.arrive': {
    url: url('avatar/teleport-in.mp3'),
    options: spatialOptions,
  },
  'avatar.chat': {
    url: url('avatar/chat-message.mp3'),
    options: spatialOptions,
  },
  'avatar.emote': {
    url: url('avatar/emote.mp3'),
    options: spatialOptions,
  },
  'avatar.leave': {
    url: url('avatar/teleport-out.mp3'),
    options: spatialOptions,
  },
  'build.place': {
    url: url('build/place.mp3'),
    options: alertOptions,
  },
  'build.extend': {
    url: url('build/extend.mp3'),
    options: alertOptions,
  },
  'build.start': {
    url: url('build/start.mp3'),
    options: alertOptions,
  },
  'build.select': {
    url: url('build/select.mp3'),
    options: alertOptions,
  },
}
