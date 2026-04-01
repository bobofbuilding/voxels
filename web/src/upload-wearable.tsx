import { Component, createRef } from 'preact'
import { JSXInternal } from 'preact/src/jsx'
import { Collection } from '../../common/helpers/collections-helpers'
import { CollectibleRecord } from '../../common/messages/collectibles'
import { VoxModel } from '../../common/vox-import/types'
import CustomCollectibleAttributes from './components/collectibles/custom-collectible-traits'
import { TraitType } from './components/collections/custom-collection-traits'
import CollectionSubmissionsAdmin from './components/collections/mint-admin'
import { FileField } from './components/fields/file-field'
import { Submit } from './components/fields/submit'
import Panel, { PanelType } from './components/panel'
import { app, AppEvent } from './state'
import { bytesToBase64 } from './utils'
import { WearableViewer } from './wearable-viewer'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const VoxReader = require('@sh-dave/format-vox').VoxReader

export enum WearableCategory {
  Accessory = 'accessory',
  Headwear = 'headwear',
  Facewear = 'facewear',
  Upperbody = 'upperbody',
  Lowerbody = 'lowerbody',
  Feet = 'feet',
  Arms = 'arms',
  Hands = 'hands',
}

interface Props {
  collection: Collection
}

interface UploadState {
  name: string
  description: string
  author: string | null
  issues: number
  category: WearableCategory
  customAttributes: TraitType[]
  data?: Uint8Array
  preview?: string | ArrayBuffer | null
  uploading: boolean
  uploaded: boolean
  accepted: boolean
  collectibles?: CollectibleRecord[]
  error?: string
}

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

export default class UploadWearable extends Component<Props, UploadState> {
  private canvas = createRef<HTMLCanvasElement>()
  private viewer?: WearableViewer

  constructor() {
    super()

    this.state = {
      name: '',
      description: '',
      author: null,
      issues: 8,
      category: WearableCategory.Headwear,
      customAttributes: [],
      uploading: false,
      uploaded: false,
      accepted: false,
    }
  }

  get defaultBodyPart() {
    switch (this.state.category) {
      case WearableCategory.Accessory:
        return 'the neck'
      case WearableCategory.Facewear:
        return 'the face'
      case WearableCategory.Arms:
        return 'the right arm'
      case WearableCategory.Feet:
        return 'the right foot'
      case WearableCategory.Hands:
        return 'the right hand'
      case WearableCategory.Headwear:
        return 'top of the head'
      case WearableCategory.Lowerbody:
        return 'the hip'
      case WearableCategory.Upperbody:
        return 'the torso'
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _never: never = this.state.category
        return _never
    }
  }

  private get collection() {
    return this.props.collection
  }

  private get isOffChain() {
    return this.props.collection.chainid === 0
  }

  private get canPublicSubmit() {
    return this.collection?.settings?.canPublicSubmit
  }

  private get isOwner() {
    return this.collection?.owner?.toLowerCase() === app.state.wallet?.toLowerCase()
  }

  private get isDisabled() {
    if (this.state.uploading) return true
    if (!this.state.name) return true
    if (!this.state.author) return true
    if (!this.state.preview) return true

    return false
  }

  clear() {
    this.setState({
      name: '',
      description: '',
      issues: 8,
      category: WearableCategory.Headwear,
      customAttributes: this.collection?.custom_attributes_names || [],
      data: undefined,
      preview: undefined,
      accepted: false,
    })
  }

  onAppLoad = () => {
    this.setState({ author: app.state.wallet })
  }

  componentDidMount() {
    if (!app.state.wallet) {
      console.error('No wallet!')
      this.setState({ error: 'No wallet found, are you logged in?' })
    }
    this.setState({ author: app.state.wallet, customAttributes: this.collection?.custom_attributes_names || [] })

    app.on(AppEvent.Load, this.onAppLoad)

    if (this.canvas.current) {
      this.viewer = new WearableViewer(this.canvas.current)
    }
  }

  upload(ev: JSXInternal.TargetedEvent<HTMLInputElement>) {
    const input = ev.currentTarget
    if (!input?.files?.[0]) return

    this.setState({ error: undefined, data: undefined, preview: undefined })

    const reader = new FileReader()

    reader.onload = (e) => {
      if (!e.target) return

      const arrayBuffer = e.target['result']
      if (!arrayBuffer || typeof arrayBuffer === 'string') return

      this.validateVox(arrayBuffer)
        .then(() => {
          this.setState({ data: new Uint8Array(arrayBuffer) })

          const readerPreview = new FileReader()
          readerPreview.onload = (e) => {
            if (!e.target) return
            const preview = e.target['result']
            this.setState({ preview }, async () => await this.loadModel())
          }
          if (!input?.files?.[0]) return
          readerPreview.readAsDataURL(input.files[0])
        })
        .catch((ex) => this.setState({ error: `${ex}` }))
    }

    reader.readAsArrayBuffer(input.files[0])
  }

  componentWillUnmount() {
    app.removeListener(AppEvent.Load, this.onAppLoad)
  }

  validateVox(buffer: ArrayBufferLike): Promise<void> {
    return new Promise((resolve, reject) => {
      VoxReader.read(buffer, (vox: VoxModel, err: string | null) => {
        if (err) return reject(err)
        if (vox.models.length > 1) return reject(new Error('multiple models not supported'))
        const size = new BABYLON.Vector3(vox.sizes[0].x, vox.sizes[0].y, vox.sizes[0].z)
        let correctlySized = true
        if (size.x > 32) correctlySized = false
        if (size.y > 32) correctlySized = false
        if (size.z > 32) correctlySized = false
        if (!correctlySized) return reject(new Error(`vox models larger than 32x32x32 are not supported, that one was ${size.x}x${size.y}x${size.z}`))
        resolve()
      })
    })
  }

  async loadModel() {
    if (!this.state.preview || !this.canvas.current) return
    const url: string | ArrayBuffer = this.state.preview || ''
    this.viewer?.loadURL(url)
  }

  checkCustomAttributes() {
    if (!this.collection.custom_attributes_names) return true
    if (this.collection.custom_attributes_names.length == 0) return true

    for (const attrib of this.collection.custom_attributes_names) {
      const t = this.state.customAttributes.find((t) => t.trait_type == attrib.trait_type)
      // shouldn't happen
      if (!t) return false
      // User wants us to ignore that attribute
      if (t.ignore) return true
      // No value was given to that attribute (SHOULD GIVE IT)
      if (!t.value) return false
    }
    return true
  }

  async submit() {
    if (!this.state.accepted) {
      app.showSnackbar('You must accept terms of service!', PanelType.Danger)
      return
    }
    if (this.state.error) {
      return
    }
    if (!this.state.name || this.state.name.trim().length < 2) {
      app.showSnackbar('Name is empty or is too short', PanelType.Danger)
      return
    }
    if (!this.isOffChain && (!this.state.issues || this.state.issues <= 0 || this.state.issues > 5000)) {
      app.showSnackbar('Issues number invalid', PanelType.Danger)
      return
    }
    if (!this.state.author || this.state.author.length < 39) {
      app.showSnackbar('Bad owner address', PanelType.Danger)
      return
    }
    if (!Object.values(WearableCategory).includes(this.state.category)) {
      app.showSnackbar('Category is invalid', PanelType.Danger)
      return
    }
    if (!this.checkCustomAttributes()) {
      app.showSnackbar('Please fill up the attributes fields and save attributes', PanelType.Danger)
      return
    }

    this.setState({ uploading: true })
    const body = JSON.stringify({
      name: this.state.name,
      description: this.state.description,
      category: this.state.category,
      author: this.state.author,
      issues: this.isOffChain ? 1000 : this.state.issues, // offChain wearables are "common" so 1000
      custom_attributes: this.state.customAttributes,
      collection_id: this.props.collection.id,
      data: bytesToBase64(this.state.data),
    })
    let p
    try {
      p = await fetch('/api/collectibles/create/wearable', {
        headers,
        method: 'post',
        body,
      })
    } catch {
      app.showSnackbar('Could not reach server, please try again')
      this.setState({ uploading: false, uploaded: false })
      return
    }

    const r = await p.json()

    if (!r.success) {
      app.showSnackbar(r.message || 'Could not Upload this wearable')
      this.setState({ uploading: false, uploaded: false })
      return
    }

    this.setState({ uploading: false, uploaded: true })
    this.clear()
  }

  render() {
    if (!this.canPublicSubmit && !this.isOwner && !(app.state.moderator ?? false)) {
      return (
        <div>
          {' '}
          <h2>Heya, you can't be here :) .</h2>
        </div>
      )
    }

    const canvasStyle = this.state.preview ? { width: 100, height: 100 } : { width: 1, height: 1 }

    return (
      <div>
        {this.canPublicSubmit && (
          <div>
            <h2>👐 This collection accepts public submissions.</h2>
            {!this.isOffChain && (
              <p>
                This means you can submit your creations to this collection. <br /> It will be reviewed by the collection's owner and minted if they want to. Once created, the wearable (in its full quantity) will be automatically
                transferred to you. <br /> ⚠️ When your creation is going through an opensea transaction, the owner of the collection can receive royalties from that sale. Visit the opensea page of this collection to learn more about it.
              </p>
            )}
          </div>
        )}
        <div>
          <h3>Upload</h3>

          <form onSubmit={this.submit.bind(this)}>
            <p>Must be less than 32 x 32 x 32 .vox file generated by magica voxel.</p>

            <FileField label=".vox file" name="voxfile" onChange={this.upload.bind(this)} disabled={this.state.uploading} />

            <div>
              <canvas ref={this.canvas} style={canvasStyle} />
              <div>{this.state.data && <small>{this.state.data.length} bytes</small>}</div>
              {this.state.preview && <br />}
            </div>

            {this.collection.custom_attributes_names?.length > 0 && (
              <div>
                <div>
                  <strong>Attributes</strong>
                </div>
                <CustomCollectibleAttributes customAttributes={this.state.customAttributes} collectionAttributesNames={this.collection.custom_attributes_names} overrideSave={this.setState.bind(this)} />
                <br />
                <br />
              </div>
            )}

            <div>
              <label>
                <input checked={this.state.accepted} type="checkbox" onClick={(e) => this.setState({ accepted: e.currentTarget['checked'] })} disabled={this.state.uploading} />I assert that I created or have rights to this wearable
              </label>
              , and agree to the{' '}
              <a href="/terms" target="_blank">
                terms of service
              </a>
            </div>
            <Submit label="Submit" disabled={this.isDisabled} />
          </form>

          {this.state.error && <Panel type="danger">{this.state.error}</Panel>}
          {this.state.uploaded && <p>Your upload was successful, Click refresh to see the submission!</p>}
        </div>

        <CollectionSubmissionsAdmin collection={this.props.collection} />
      </div>
    )
  }

  private setDescription = (value: string) => {
    if (value?.length <= 500) {
      this.setState({ description: value })
    } else {
      app.showSnackbar('Description too long (500 characters max)')
    }
  }
}

export function defaultBone(wearable: any | { category: WearableCategory }) {
  switch (wearable?.category) {
    case WearableCategory.Accessory:
      return 'Neck'
    case WearableCategory.Facewear:
      return 'Head'
    case WearableCategory.Arms:
      return 'RightArm'
    case WearableCategory.Feet:
      return 'RightFoot'
    case WearableCategory.Hands:
      return 'RightHand'
    case WearableCategory.Headwear:
      return 'HeadTop_End'
    case WearableCategory.Lowerbody:
      return 'LeftUpLeg'
    case WearableCategory.Upperbody:
      return 'Spine1'
    default:
      return 'Head'
  }
}
