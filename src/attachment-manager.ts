import { Costume, CostumeAttachment } from '../common/messages/costumes'
import { app } from '../web/src/state'
import type Avatar from './avatar'
import type { Scene } from './scene'

function isUuid(uuid: string) {
  return uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
}

export interface AttachmentWithMesh extends CostumeAttachment {
  mesh?: BABYLON.Mesh
}

export class AvatarAttachmentManager {
  skeleton: BABYLON.Skeleton | null
  attached: BABYLON.Mesh[] = []
  visible = true
  abortController = new AbortController()
  costume: Costume | null = null
  costume_id: number | null = null
  attachments: Array<AttachmentWithMesh> = []

  constructor(
    private scene: Scene,
    private avatar: Avatar,
    private readonly avatarViewDistance: number,
  ) {
    this.skeleton = avatar.skeleton
  }

  get wallet() {
    return this.avatar.wallet
  }

  dispose() {
    if (this.attached) {
      this.attached.forEach((a) => a.dispose())
    }
    if (this.attachments) {
      this.attachments.length = 0
    }
    this.abortController.abort('ABORT: disposing AvatarAttachmentManager')
  }

  /**
   * Gets the costume of the avatar from the db.
   * If isUser, the costume is already stored in app state, and won't fetch it.
   * @see /web/src/state.ts
   */
  async loadCostume(costume?: Costume) {
    if (costume) {
      this.costume_id = costume.id
      this.generateCostume(costume)
    } else if (this.avatar.isUser) {
      // use the local state for avatar costume if this avatar is us (no need to fetch twice)
      const state = await app.getState()
      this.generateCostume(state.costume)
    } else {
      this.fetchCostume()
    }
  }

  /**
   * Generate the given costume
   * @param {Object} costume the costume to generate
   * @see /web/src/state.ts
   * @returns {void} void
   */
  generateCostume(costume?: Costume) {
    // Maximum of 12 attachments
    this.abortController = new AbortController()
    // console.log('generateCostume', JSON.stringify(costume, null, 2))

    this.costume = costume ?? null

    if (costume) {
      // bnolan model has its own material and texture
      this.avatar.setSkin(costume.skin)
    }

    this.costume_id = costume?.id || null
    this.attachments = ((costume && costume.attachments) || []).slice(0, 12)
    this.avatar.isUser && app.setState({ costume: costume })
    this.loadAttachments()
  }

  /**
   * Dispose the current costume and fetch new costume.
   * @param {string} cacheKey an additional key to pass to request to bust cache
   * @returns {void} void
   */
  refreshCostume(cacheKey?: number) {
    if (this.attached) {
      this.attached.forEach((a) => a.dispose())
    }
    this.fetchCostume(cacheKey)
  }

  async fetchCostume(cacheKey?: number) {
    let url = `${process.env.API}/avatars/${this.wallet}/costume.json`
    // allow synchronized cache busting when loading new costumes
    if (cacheKey) {
      url += `?${cacheKey}`
    }

    const r = await fetch(url)
    const { success, costume } = await r.json()

    if (success && costume) {
      // set the state for costume
      this.costume = costume
      this.generateCostume(costume)
    }
  }

  /**
   * Iterates through this.attachments and generates all the attachments on the avatar.
   * @returns {void} void
   */
  async loadAttachments() {
    if (this.attached) {
      this.attached.forEach((a) => a.dispose())
    }
    this.attached = []

    for (const attachment of this.attachments) {
      try {
        await this.loadAttachment(attachment)
      } catch (e) {
        console.error(`Error loading attachment ${attachment.uuid}`, e)
      }
    }
  }

  loadAttachment = async (attachment: AttachmentWithMesh | Omit<AttachmentWithMesh, 'chain_id'>) => {
    const name = attachment.bone
    const isBeingTried = attachment.uuid.startsWith('try-')
    if (!this.skeleton) {
      return
    }
    const index = this.skeleton.getBoneIndexByName(`mixamorig:${name}`)

    if (index == -1) {
      console.log(`Bad bone name ${name}`)
      return
    }

    const bone = this.skeleton.bones[index]

    if (!attachment.wearable_id) {
      return
    }

    let url

    if (isUuid(attachment.wearable_id.toString())) {
      url = `/api/wearables/${attachment.wearable_id}/vox`
    } else {
      url = `/api/wearables/${attachment.collection_address}/${attachment.wearable_id}/vox`
    }

    const opts = { invertX: false, signal: this.abortController.signal }
    const mesh = await this.scene.importVox(url, opts)
    mesh.name = 'wearable'

    this.attached.push(mesh)
    attachment['mesh'] = mesh

    if (bone && this.avatar.avatarMesh) {
      mesh.attachToBone(bone, this.avatar.avatarMesh)
    }
    mesh.isPickable = false
    mesh.metadata = {
      parcel: isBeingTried ? window.connector.enteredParcel?.id : null,
      isAvatarPart: true,
    }

    mesh.addLODLevel(this.avatarViewDistance, null)

    const position = new BABYLON.Vector3(attachment.position[0], attachment.position[1], attachment.position[2])
    mesh.position.copyFrom(position)

    // eulers
    const rotation = new BABYLON.Vector3(BABYLON.Angle.FromDegrees(attachment.rotation[0]).radians(), BABYLON.Angle.FromDegrees(attachment.rotation[1]).radians(), BABYLON.Angle.FromDegrees(attachment.rotation[2]).radians())
    mesh.rotationQuaternion = null
    mesh.rotation = rotation

    // scale
    mesh.scaling.set(attachment.scaling[0], attachment.scaling[1], attachment.scaling[2])

    if (!this.visible) {
      mesh.setEnabled(false)
    }
  }

  refreshSingleAttachment(collectible_uuid: string) {
    const attachment = this.attachments.find((col) => col.uuid == collectible_uuid)
    if (!attachment) {
      console.warn(`Attachment with uuid ${collectible_uuid} not found`)
      return
    }
    // No attachment found, just generate new one
    if (!attachment.mesh) {
      this.loadAttachment(attachment)
      return
    }
    const collectibleMesh = this.attached.find((col) => col.uniqueId == attachment.mesh!.uniqueId)
    // Attachment was found, nerf the previous mesh, clean the attached array and generate a new collectible.
    if (collectibleMesh) {
      this.attached.splice(this.attached.indexOf(collectibleMesh), 1)
      collectibleMesh.dispose()
    }
    this.loadAttachment(attachment)
  }

  getAttachmentByUuid(collectible_uuid: string): AttachmentWithMesh | null {
    const a = this.attachments.find((a) => a.uuid == collectible_uuid)
    return a ?? null
  }

  getAttachmentByCollectionIdAndTokenId_BeingTried(collection_id: number, token_id: number): AttachmentWithMesh | null {
    const a = this.attachments.find((w) => w.collection_id == collection_id && w.wearable_id == token_id && w.uuid.startsWith('try-'))
    return a ?? null
  }

  wear = (attachment: CostumeAttachment) => {
    if (typeof attachment.uuid !== 'string' || typeof attachment.chain_id !== 'number' || typeof attachment.wearable_id !== 'number') {
      return
    }
    // Create new collectible and generate it on avatar.
    this.attachments.push(attachment)
    this.refreshSingleAttachment(attachment.uuid)
  }

  remove = (collectible_uuid: string) => {
    // Remove a collectible from the avatar
    const wearable = this.getAttachmentByUuid(collectible_uuid)
    if (!wearable) {
      return
    }

    this.attachments.splice(this.attachments?.indexOf(wearable), 1)
    const mesh = wearable.mesh
    if (mesh) {
      this.attached.splice(this.attached.indexOf(mesh), 1)
      mesh.dispose()
    } else {
      this.loadAttachments()
    }
  }

  /**
   * Method to disable all attachments on an avatar
   * @returns {void} void
   */
  hideAllWearables() {
    if (this.visible && !!this.attachments) {
      this.attachments.forEach((attachment) => attachment.mesh?.setEnabled(false))
    }
    this.visible = false
  }

  /**
   * Method to enable all attachments on the avatar
   * @returns {void} void
   */
  showAllWearables() {
    if (!this.visible && !!this.attachments) {
      this.attachments.forEach((attachment) => attachment.mesh?.setEnabled(true))
    }
    this.visible = true
  }
}
