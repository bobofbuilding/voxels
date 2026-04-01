import { seededShuffle } from '../../common/helpers/utils'

export interface TrackInfo {
  fileName: string
  duration: number
  volume?: number
  fallback?: string
}

interface SoundtrackInfo {
  name?: string
  main: TrackInfo
  ambient?: TrackInfo
  suburbs?: Array<string>
  isDefault?: boolean
}

const soundtracks: Array<SoundtrackInfo> = [
  // used randomly throughout world
  {
    main: { fileName: 'synthdad.webm', fallback: 'synthdad-AAC.m4a', duration: 2136 },
    ambient: { fileName: 'synthdad-ambient.webm', fallback: 'synthdad-ambient-AAC.m4a', duration: 1071 },
    isDefault: true,
  },
  // FIXME: have to turn some tracks down until we move all tracks to 14 LUFS
  {
    suburbs: ['Andromeda'],
    main: { fileName: 'blackhole.webm', duration: 743, volume: 0.2 },
    ambient: { fileName: 'blackhole-ambient.webm', duration: 743, volume: 0.8 },
    isDefault: true,
  },
  {
    suburbs: ['Babylon'],
    main: { fileName: 'wonders.webm', duration: 1395 },
    ambient: { fileName: 'wonders-ambient.webm', duration: 624 },
    isDefault: true,
  },
  {
    suburbs: ['Fantasy Fields'],
    main: { fileName: 'verge.webm', duration: 944 },
    ambient: { fileName: 'verge-ambient.webm', duration: 704 },
    isDefault: true,
  },
  {
    suburbs: ['Fauna'],
    main: { fileName: 'saharasafari.webm', duration: 821, volume: 0.5 },
    ambient: { fileName: 'saharasafari-ambient.webm', duration: 725, volume: 1.2 },
    isDefault: true,
  },
  {
    suburbs: ['Flora'],
    main: { fileName: 'forestfriends.webm', duration: 644, volume: 0.2 },
    ambient: { fileName: 'forestfriends-ambient.webm', duration: 644, volume: 0.8 },
    isDefault: true,
  },
  {
    suburbs: ['Makers'],
    main: { fileName: 'given.webm', duration: 1074 / 2 },
    ambient: { fileName: 'given-ambient.webm', duration: 504 },
    isDefault: true,
  }, // easter egg, won't do big drums unless you are exploring for more than 10 minutes
  {
    suburbs: ['Mars'],
    main: { fileName: 'beyonder.webm', duration: 688 },
    ambient: { fileName: 'beyonder-ambient.webm', duration: 632 },
    isDefault: true,
  },
  {
    suburbs: ['Midtown'],
    main: { fileName: 'seclusion.webm', duration: 974 },
    ambient: { fileName: 'seclusion-ambient.webm', duration: 680 },
    isDefault: true,
  },
  {
    suburbs: ['Oasis'],
    main: { fileName: 'skybox.webm', duration: 1312 },
    ambient: { fileName: 'skybox-ambient.webm', duration: 448 },
    isDefault: true,
  },
  {
    suburbs: ['Shenzhen'],
    main: { fileName: 'slitscan.webm', duration: 1124 },
    ambient: { fileName: 'slitscan-ambient.webm', duration: 496 },
    isDefault: true,
  },
  {
    suburbs: ['Scripting'],
    main: { fileName: 'horizon.webm', duration: 1046 },
    ambient: { fileName: 'horizon-ambient.webm', duration: 784 },
    isDefault: true,
  },
  {
    suburbs: ['Pastel'],
    main: { fileName: 'crayoncartel.webm', duration: 436, volume: 1.0 },
    ambient: { fileName: 'crayoncartel-ambient.webm', duration: 436 },
    isDefault: true,
  },
  {
    suburbs: ['Venice'],
    main: { fileName: 'blessedcanals.webm', duration: 570, volume: 0.7 },
    ambient: { fileName: 'blessedcanals-ambient.webm', duration: 570 },
    isDefault: true,
  },

  // one-off island/suburb specific
  { suburbs: ['Area 51'], main: { fileName: 'drohneburg.webm', duration: 1432 } },
  { suburbs: ['Deep South'], main: { fileName: '808fate.webm', duration: 870 / 2 } },
  { suburbs: ['Doom'], main: { fileName: 'overworld.webm', duration: 654 } },
  { suburbs: ['Frankfurt'], main: { fileName: 'cineverse.webm', duration: 1194 } },
  { suburbs: ['Gangnam'], main: { fileName: 'generation-vox.webm', duration: 1099 / 2 } }, // easter egg, k-pop doesn't drop unless you are exploring for more than 5 minutes
  { suburbs: ['Hiro'], main: { fileName: 'into.webm', duration: 1472 } },
  { suburbs: ['Junkyard'], main: { fileName: 'roadkill.webm', duration: 1064 } },
  { suburbs: ['Kitties', 'Punks', 'Axies'], main: { fileName: 'purrfection.webm', duration: 913 } },
  { suburbs: ['Le Marais'], main: { fileName: 'aftermath.webm', duration: 1261 } },
  { suburbs: ['Little Tokyo', 'Tokyo'], main: { fileName: 'zenwave.webm', duration: 1256 } },
  { suburbs: ['Memes'], main: { fileName: 'glitched.webm', duration: 582 } },
  { suburbs: ['North Pole', 'Igloo'], main: { fileName: 'frontier.webm', duration: 1248 } },
  { suburbs: ['Electron'], main: { fileName: 'electron.webm', duration: 276, volume: 0.5 } },
  { suburbs: ['Ceres'], main: { fileName: 'ceres.webm', duration: 190, volume: 0.5 } },
  { suburbs: ['Scarcity'], main: { fileName: 'subterranean.webm', volume: 0.3, duration: 1062 } },
]

export const mainTracks: Map<string, TrackInfo> = new Map()
export const ambientTracks: Map<string, TrackInfo> = new Map()

soundtracks.forEach((soundtrack) => {
  if (soundtrack.suburbs) {
    soundtrack.suburbs.forEach((suburb) => {
      mainTracks.set(suburb, soundtrack.main)
      if (soundtrack.ambient) {
        ambientTracks.set(suburb, soundtrack.ambient)
      }
    })
  }
})

// Spaces
mainTracks.set('Void', { fileName: 'void.webm', duration: 876 })

// Underwater
mainTracks.set('Ocean', { fileName: 'submerge.webm', volume: 1, duration: 704 })

// TODO: perform deterministic track shuffling during runtime, instead of only on load

// new default track every 2 hours
// choose from default tracks, shuffle track order once all tracks have been played
const currentWorldStep = Math.floor(Date.now() / 1000 / 60 / 60 / 2)
const fallbackTracks = soundtracks.filter((s) => s.isDefault)
const currentLot = Math.floor(currentWorldStep / fallbackTracks.length)
const shuffledTracks = seededShuffle(fallbackTracks, currentLot) as Array<SoundtrackInfo>

const currentDefaultSoundtrack = shuffledTracks[currentWorldStep % fallbackTracks.length]
mainTracks.set('default', currentDefaultSoundtrack.main)

if (currentDefaultSoundtrack.ambient) {
  ambientTracks.set('default', currentDefaultSoundtrack.ambient)
}
