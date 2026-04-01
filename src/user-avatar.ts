import { Costume } from '../common/messages/costumes'
import Avatar, { AvatarRecord } from './avatar'
import type { Scene } from './scene'

// factory function to set up and create a avatar representing the player
export async function LoadUserAvatar(scene: Scene, parent: BABYLON.TransformNode, uuid: string, description: AvatarRecord): Promise<UserAvatar> {
  await Avatar.ensureRootAvatar(scene)
  return new UserAvatar(scene, parent, uuid, description)
}

export class UserAvatar extends Avatar {
  constructor(scene: Scene, parent: BABYLON.TransformNode, uuid: string, description: AvatarRecord) {
    // the users avatar is always created as soon as this call is made
    const joined = Date.now()
    super(scene, parent, joined, uuid, description)
    this._isUser = true
    this.tickRate = 1000 / 60
  }

  getCostume(): Costume | undefined {
    return this._attachmentManager?.costume ?? undefined
  }

  setCostume(costume: Costume) {
    console.log('setCostume', costume)

    if (!this._attachmentManager) {
      console.log('no attachment manager')
      return
    }

    this._attachmentManager.dispose()
    this._attachmentManager.loadCostume(costume)
  }

  // get costumeId() {
  //   return this._attachmentManager?.costume_id
  // }
}
