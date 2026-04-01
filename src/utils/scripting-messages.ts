import { FeatureRecord } from '../../common/messages/feature'
import { Animations } from '../avatar-animations'
import { guiControls } from '../ui/gui/gui'

export enum ScriptingActions {
  Snapshot = 'snapshot',
  Create = 'create', // Create a feature
  Update = 'update', // Update a feature
  Destroy = 'destroy', // Fully destroys the feature
  Remove = 'remove', // nerfs it visually
  Chat = 'chat',
  Play = 'play',
  Pause = 'pause',
  Unpause = 'unpause',
  Stop = 'stop',
  Animate = 'animate',
  Screen = 'screen',
  Teleport = 'player-teleport',
  Emote = 'player-emote',
  CreateFeatureGui = 'create-feature-gui',
  DestroyFeatureGui = 'destroy-feature-gui',
  UpdateFeatureGui = 'update-feature-gui',
  PlayerKick = 'player-kick',
}

export interface ScriptingMessage {
  type: ScriptingActions
  uuid?: string
}

export interface ScriptingMessage_Snapshot extends ScriptingMessage {
  parcel: any
}

export interface ScriptingMessage_Create extends ScriptingMessage {
  content: FeatureRecord
}

export interface ScriptingMessage_Update extends ScriptingMessage {
  uuid: string
  content: any
}

export interface ScriptingMessage_Animate extends ScriptingMessage {
  uuid: string
  animations: any[]
}

export interface ScriptingMessage_VidScreen extends ScriptingMessage {
  uuid: string
  screen: Uint8Array
}

export interface ScriptingMessage_Teleport extends ScriptingMessage {
  uuid: string
  coordinates: any
}

export interface ScriptingMessage_Emote extends ScriptingMessage {
  uuid: string
  emote: string
}

export interface ScriptingMessage_AvatarAnimate extends ScriptingMessage {
  uuid: string
  animation: Animations
}

export interface ScriptingMessage_ActionGui extends ScriptingMessage {
  uuid: string
  gui: { uuid: string; listOfControls?: guiControls[]; billBoardMode?: number }
}

export interface ScriptingMessage_UpdateGui extends ScriptingMessage {
  uuid: string
  control: guiControls
}

export interface ScriptingMessage_KickMessage extends ScriptingMessage {
  uuid: string
  reason?: string
}
