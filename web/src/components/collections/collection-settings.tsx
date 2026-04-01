import { Component, createRef } from 'preact'
import { convertDataURItoJPGFile, getExtensionFromDatarUrl, uploadMedia } from '../../../../common/helpers/upload-media'
import { resizeAndCallback } from '../../helpers/collections-helper'
import { app } from '../../state'
import { fetchAPI } from '../../utils'
import Panel, { PanelType } from '../panel'
import CustomCollectionTraits, { TraitType } from './custom-collection-traits'
import { Polygon } from '../../../../common/helpers/chain-helpers'
import { Collection, CollectionSettings as Settings } from '../../../../common/helpers/collections-helpers'
import { JSXInternal } from 'preact/src/jsx'
import { Spinner } from '../../spinner'
import { NumberField } from '../fields/number-fields'
import { TextField } from '../fields/text-field'
import { ColorField } from '../fields/color-field'
import { ImageField } from '../fields/image-field'
import { CheckboxField } from '../fields/checkbox-field'
import { ReadonlyField } from '../fields/readonly-field'
import { Submit } from '../fields/submit'
import { Form } from '../fields/form'

export interface Props {
  collection: Collection
  onRefresh?: (cachebust: boolean) => void
  path?: string
}

interface State {
  name?: string
  description?: string
  image_url: string | null
  customAttributesNames?: TraitType[]
  collection: Collection
  settings?: Settings
  canPublicSubmit?: boolean
  coverColor: string
  twitterHandle?: string
  virtualStore?: string
  website?: string
  featured?: string
  error?: string
  canDelete?: boolean
  saving: boolean
  waitingForChain: boolean
  uploadingMedia: boolean
}

export default class CollectionSettings extends Component<Props, State> {
  canvas = createRef<HTMLCanvasElement>()

  constructor(props: Props) {
    super()

    this.state = {
      collection: props.collection,
      name: props.collection.name,
      description: props.collection.description,
      image_url: null,
      customAttributesNames: props.collection.custom_attributes_names || [],
      settings: props.collection.settings,

      canPublicSubmit: !!props.collection.settings?.canPublicSubmit,
      coverColor: props.collection.settings?.coverColor ?? '#d8d8d8',
      twitterHandle: props.collection.settings?.twitterHandle ?? '',
      virtualStore: props.collection.settings?.virtualStore,
      featured: props.collection.settings?.featured,
      website: props.collection.settings?.website,
      canDelete: false,
      saving: false,
      waitingForChain: false,
      uploadingMedia: false,
    }
  }

  private get collection() {
    return this.state.collection
  }

  componentDidMount() {
    this.fetch()
  }

  updateCustomAttributes(customAttributesNames: TraitType[]) {
    this.setState({ customAttributesNames }, () => this.saveCollection())
  }

  render() {
    let canvasStyle = { width: 1, height: 1 }
    if (this.state.uploadingMedia || this.state.image_url) {
      canvasStyle = { width: 100, height: 100 }
    }

    return (
      <div>
        {!this.state.collection && <p>Loading...</p>}

        <Form onSubmit={() => this.saveCollection()}>
          <h2>Settings</h2>

          {this.state.error && <Panel type="danger">{this.state.error}</Panel>}
          <ReadonlyField label="Collection id">{this.state.collection.id}</ReadonlyField>
          <TextField label="Collection Name" name="name" value={this.state.name ?? ''} onChange={(e) => this.setState({ name: e.currentTarget['value'] })} disabled={this.state.saving} />

          <div class="f">
            <label>Description</label>
            <textarea name="description" value={this.state.description ?? ''} onChange={(e) => this.setState({ description: e.currentTarget['value'] })} disabled={this.state.saving} />
          </div>

          <div>
            {this.state.uploadingMedia && <Spinner size={16} />}
            <div style={canvasStyle}>
              <canvas ref={this.canvas} width={100} height={100}></canvas>
            </div>
          </div>
          <Submit label="Save changes" disabled={this.state.saving} />
          <h2>Links</h2>
          <TextField label="Twitter handle" name="twitterHandle" value={this.state.twitterHandle ?? ''} onChange={(e) => this.setState({ twitterHandle: e.currentTarget['value'] })} disabled={this.state.saving} />
          <TextField label="Website URL" name="website" size={48} value={this.state.website ?? ''} onChange={(e) => this.setState({ website: e.currentTarget['value'] })} disabled={this.state.saving} placeholder="https://"></TextField>

          <NumberField label="In-world store" name="website" placeholder="1" size={6} value={this.state.virtualStore} onChange={(e) => this.setState({ virtualStore: e.currentTarget['value'] })} disabled={this.state.saving}>
            <small>(parcel id)</small>
          </NumberField>

          <NumberField label="Featured collectible" name="featured" placeholder="1" size={6} value={this.state.featured} onChange={(e) => this.setState({ featured: e.currentTarget['value'] })} disabled={this.state.saving}>
            <small>(token id)</small>
          </NumberField>

          <Submit label="Save changes" disabled={this.state.saving} />

          <h2>Mint</h2>

          <CheckboxField
            label="Allow public to send submission"
            name="canPublicSubmit"
            checked={this.state.canPublicSubmit ?? false}
            onChange={(e) => this.setState({ canPublicSubmit: e.currentTarget['checked'] })}
            disabled={this.state.saving}
          >
            {this.state.canPublicSubmit ? <small>By enabling this feature you are liable for collectibles you approve.</small> : <></>}
          </CheckboxField>

          <ReadonlyField label="Your contract URI">
            <>
              {`https://www.voxels.com/c/${this.collection?.id}/{token_id}`}
              <small>(legacy)</small>
            </>
          </ReadonlyField>

          <Submit label="Save changes" disabled={this.state.saving} />

          {this.collection?.collectiblesType == 'wearables' && (
            <div>
              <h2>Custom (optional) attributes</h2>
              <CustomCollectionTraits customAttributes={this.state.customAttributesNames} onSave={this.updateCustomAttributes.bind(this)} />
            </div>
          )}

          {this.collection?.chainid == Polygon && (
            <div>
              <h2>Sales</h2>
              <div>
                <p>When a sale is made on Opensea, you get transfered POS-WETH on the Polygon chain, not on Ethereum mainnet.</p>
                <Panel type="info">
                  To transfer the Weth back to Ethereum Mainnet WETH, use the Polygon PoS bridge V2.
                  <a href="https://wallet.polygon.technology/bridge/">Click here</a>
                </Panel>
              </div>
            </div>
          )}
        </Form>
      </div>
    )
  }

  private fetch(cachebust = false) {
    let url = `/api/collections/${this.collection?.id}.json`
    if (cachebust) url += `?cb=${Date.now()}`
    fetchAPI(url).then((r) => {
      if (r.success) {
        r.collection.customAttributesNames = r.collection.custom_attributes_names
        r.collection.collectiblesType = r.collection.collectibles_type
      }
      this.setState({ collection: r.collection })
    })
  }

  private saveSettings() {
    return {
      ...this.collection?.settings,
      canPublicSubmit: this.state.canPublicSubmit,
      coverColor: this.state.coverColor,
      twitterHandle: this.state.twitterHandle,
      virtualStore: this.state.virtualStore,
      featured: this.state.featured,
      website: this.state.website,
    }
  }

  private async onMediaResized(dataURL: string) {
    const extension = getExtensionFromDatarUrl(dataURL)
    const file = convertDataURItoJPGFile(dataURL, `collection_` + this.collection?.id + `.` + extension)
    const upload = await uploadMedia(file) //Could be in its own "collection" folder

    if (!upload.success) {
      this.setState({ uploadingMedia: false })
      app.showSnackbar('Something went wrong while uploading your image')
      this.setState({ image_url: '', uploadingMedia: false })
      return
    }
    this.setState({ image_url: upload.location, uploadingMedia: false })
  }

  private resizeAndUpload(ev: JSXInternal.TargetedEvent<HTMLInputElement>) {
    if (!ev.currentTarget?.files?.[0]) return

    this.setState({ uploadingMedia: true })

    const resizeFail = () => {
      this.setState({ uploadingMedia: false })
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      if (!e.target) return
      const img = document.createElement('img')
      img.width = 100
      img.height = 100
      if (e.target.readyState == FileReader.DONE && this.canvas.current) {
        const ctx = this.canvas.current.getContext('2d')
        ctx?.clearRect(0, 0, this.canvas.current.width, this.canvas.current.height)
        img.onload = () => this.canvas.current && resizeAndCallback(this.canvas.current, img, this.onMediaResized.bind(this), resizeFail)
        img.src = e.target.result as string
      }
    }
    reader.readAsDataURL(ev.currentTarget.files[0])
  }

  private saveCollection() {
    if (this.state.uploadingMedia) {
      app.showSnackbar('Please wait for your image to be fully loaded')
      return
    }

    const c: Record<string, unknown> = {
      ...this.state.collection,
      settings: this.saveSettings(),
      name: this.state.name ?? '',
      description: this.state.description ?? '',
      customAttributesNames: this.state.customAttributesNames ?? [],
      image_url: this.state.image_url,
    }

    this.setState({ saving: true, error: undefined })

    fetchAPI(`${process.env.API}/collections/update`, {
      method: 'put',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(c),
    })
      .then((r) => {
        if (!r.success) throw new Error(r.message || 'Something went wrong')
        app.showSnackbar('Settings saved', PanelType.Success)
        this.setState({ collection: r.collection })
        this.props.onRefresh?.(true)
      })
      .catch((ex) => this.setState({ error: ex.toString() || 'Something went wrong' }))
      .finally(() => this.setState({ saving: false, waitingForChain: false }))
  }
}
