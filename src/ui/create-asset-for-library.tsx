import { Component, render } from 'preact'
import { requestPointerLockIfNoOverlays } from '../../common/helpers/ui-helpers'
import { app } from '../../web/src/state'
import { unmountComponentAtNode } from 'preact/compat'
import Panel, { PanelType } from '../../web/src/components/panel'
import { convertDataURItoJPGFile, uploadMedia } from '../../common/helpers/upload-media'
import { FeatureAssetCategory, LibraryAsset, LibraryAsset_Type, ScriptAssetCategory, TypeOfLibraryAsset } from '../library-asset'
import type { templateFromFeature as _templateFromFeature } from '../tools/feature'
import { FeatureTemplate } from '../features/_metadata'

interface Props {
  onClose?: () => void
  assetToBeShared: FeatureTemplate | string
  image?: string
}

const SCRIPT_IMAGE_URL = `${process.env.ASSET_PATH}/images/scripting-default.png`

interface State {
  error: string | null
  uploading: boolean
  category: FeatureAssetCategory | ScriptAssetCategory
  name: string | undefined
  description: string | undefined
  public: boolean
}

export default class CreateLibraryAssetWindow extends Component<Props, State> {
  static currentElement: HTMLElement | null
  readonly assetToBeShared: FeatureTemplate | string
  readonly type: TypeOfLibraryAsset = 'feature'
  image: string

  constructor(props: Props) {
    super()

    this.assetToBeShared = props.assetToBeShared
    if (typeof props.assetToBeShared === 'string') {
      this.type = 'script'
      this.image = SCRIPT_IMAGE_URL
    } else if (props.assetToBeShared.children) {
      this.type = 'group'
      this.image = props.image!
    } else {
      this.type = 'feature'
      this.image = props.image!
    }

    this.state = {
      error: null,
      uploading: false,
      category: this.type == 'script' ? ScriptAssetCategory.Random : FeatureAssetCategory.Miscellaneous,
      name: null!,
      description: null!,
      public: true,
    }
  }

  get content() {
    return [this.assetToBeShared]
  }

  get connector() {
    return window.connector
  }

  get categoriesOptions() {
    const categories = this.type == 'script' ? Object.entries(ScriptAssetCategory) : Object.entries(FeatureAssetCategory)
    return categories.map(([value, category]) => {
      return <option value={category}>{value}</option>
    })
  }

  get featureIcon() {
    // I use the vox model as the default icon for 'single-feature' assets
    const icon = this.type == 'group' ? this.type : this.type == 'script' ? 'scripting-icon' : 'vox-model'
    return `${process.env.ASSET_PATH}/icons/${icon}.png`
  }

  static async Capture(engine: BABYLON.Engine, scene: BABYLON.Scene, templateFromFeature: typeof _templateFromFeature) {
    const dump = async (engine: BABYLON.Engine, successCallback: (base64: string) => void): Promise<void> => {
      // Read the contents of the framebuffer
      const screenWidth = engine.getRenderWidth()
      const screenHeight = engine.getRenderHeight()
      const inputWidth = Math.floor(Math.min(screenWidth, screenHeight) * 0.9) // 90 % of the width or height of the screen, whichever is smaller
      const inputHeight = inputWidth // Make a square since the result will be displayed on a square card

      let outputWidth = inputWidth
      let outputHeight = inputHeight

      // Set max output size to 1200x892, but preserving aspect ratio
      const clampFirstArgPreservingAspectRatio = (a: number, b: number, aMax: number) => (a <= aMax ? [a, b] : [aMax, Math.floor((b * aMax) / a)])
      ;[outputWidth, outputHeight] = clampFirstArgPreservingAspectRatio(outputWidth, outputHeight, 1200)
      ;[outputHeight, outputWidth] = clampFirstArgPreservingAspectRatio(outputHeight, outputWidth, 892)

      const xfromCenter = Math.floor((screenWidth - inputWidth) / 2)
      const yfromCenter = Math.floor((screenHeight - inputHeight) / 2)

      //Reading datas from WebGL
      const data = (await engine.readPixels(xfromCenter, yfromCenter, inputWidth, inputHeight)) as Uint8Array
      const imageData = new ImageData(new Uint8ClampedArray(data.buffer), inputWidth, inputHeight) // the ImageData ctor is fussy

      // Create a 2D canvas to store the intermediate result, which still needs to be scaled and vertically flipped
      const canvas = document.createElement('canvas')
      canvas.width = inputWidth
      canvas.height = inputHeight

      const context = canvas.getContext('2d')

      // Copy the pixels there
      if (context) {
        context.putImageData(imageData, 0, 0)

        // Create a second 2D canvas to store the final output
        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = outputWidth
        outputCanvas.height = outputHeight
        const outputContext = outputCanvas.getContext('2d')

        // Copy again, scaling and flipping vertically
        if (outputContext) {
          outputContext.translate(0, outputCanvas.height)
          outputContext.scale(outputWidth / inputWidth, -outputHeight / inputHeight)
          outputContext.drawImage(canvas, 0, 0)

          const base64Image = outputCanvas.toDataURL('image/jpeg', 0.85)
          successCallback(base64Image)
        }
      }
    }

    return new Promise((resolve) =>
      BABYLON.Tools.CreateScreenshotUsingRenderTarget(
        engine,
        scene.activeCamera as BABYLON.Camera,
        {
          width: engine.getRenderWidth(),
          height: engine.getRenderHeight(),
        },
        () => {
          dump(engine, (image) => {
            const ui = window.ui
            if (!ui) {
              return
            }
            resolve(true)
            const feature = ui.featureTool.selection.feature
            if (!feature) throw `(Capture) feature not found`
            const template = templateFromFeature()(feature)
            if (feature && image) {
              showCreateLibraryAsset(template, image)
            }
          })
        },
      ),
    )
  }

  close = () => {
    this.props.onClose && this.props.onClose()
  }

  async post() {
    this.setState({ uploading: true })
    const body = {
      type: this.type,
      author: app.state.wallet,
      content: this.content,
      category: this.state.category,
      name: this.state.name,
      description: this.state.description,
      public: this.state.public,
    } as LibraryAsset_Type

    const asset = new LibraryAsset(body)
    if (this.type === 'script') {
      // if it's a script just straight up use the static script image.
      asset.image_url = this.image!
    } else {
      const imageFile = convertDataURItoJPGFile(this.image, `${encodeURI(this.state.name || '')}_asset_library_` + Date.now() + '.jpg')
      let uploadResult

      try {
        uploadResult = await uploadMedia(imageFile, 'assetlibrary')
      } catch {
        uploadResult = { success: false as const, error: 'Could not upload image for this asset, try again later' }
      }

      if (!uploadResult.success) {
        this.setState({ uploading: false })
        app.showSnackbar(uploadResult.error, PanelType.Danger)
        return
      }

      asset.image_url = uploadResult.location
    }

    const r = await asset.create()

    if (!r.success) {
      this.setState({ uploading: false, error: r.message || 'Something went wrong, please try again' })

      return
    } else {
      app.showSnackbar('Asset saved in the asset library!', PanelType.Success)
    }

    this.setState({ uploading: false })
    this.close()
  }

  validateAndSubmit() {
    if (!app.signedIn) {
      this.setState({ error: 'You are not signed in' })
      return
    }
    if (!this.state.name || this.state.name?.length < 2) {
      this.setState({ error: 'Name is invalid.' })
      return
    }
    if (this.state.name && this.state.name.length > 50) {
      this.setState({ error: 'Name is too long. (>50 characters)' })
      return
    }
    if (!this.assetToBeShared || this.content.length == 0) {
      this.setState({ error: 'Content of this asset is invalid.' })
      return
    }
    if (this.state.description && this.state.description.length > 200) {
      this.setState({ error: 'Description is too long (>200 characters).' })
      return
    }
    if (!this.image) {
      this.setState({ error: 'An image is needed for this asset' })
      return
    }
    this.post()
  }

  setCategory(unsafeCategory: FeatureAssetCategory | ScriptAssetCategory) {
    this.setState({ category: unsafeCategory })
  }

  render() {
    return (
      <div className="OverlayWindow -auto-height">
        <header>
          <h3>Publish asset</h3>

          <button className="close" onClick={() => this.close()}>
            &times;
          </button>
        </header>

        <section class="SplitPanel">
          <aside class={'panel_left'}>
            <div class="AssetCard -large -preview">
              <header>
                <div class="name">{this.state.name || 'My Asset'}</div>
              </header>
              {this.type === 'script' ? <img src={this.image} /> : <ContentIframe content={this.content as FeatureTemplate[]} />}

              <div>
                <div class="type">
                  <img src={this.featureIcon} title={this.type} />
                </div>
                <div class="author">Author: {app.state.name}</div>
              </div>
            </div>
          </aside>
          <div class="Panel">
            <div class="NewAssetOptions">
              <h4>Asset name*</h4>
              <input type="text" placeholder={'My Asset'} id="asset-name" maxLength={50} value={this.state.name} onInput={(e) => this.setState({ name: e.currentTarget.value })} />

              <h4>Description*</h4>
              <textarea placeholder={'Description'} value={this.state.description} maxLength={250} onInput={(e) => this.setState({ description: e.currentTarget.value })} />

              <h4>Category</h4>
              <select value={this.state.category} onInput={(e) => this.setCategory(e.currentTarget.value as any)}>
                {this.categoriesOptions}
              </select>

              <h4>Permissions</h4>
              <form class="PermissionsRadioSelector">
                <div>
                  <label>
                    <input checked={this.state.public} onClick={(e) => this.setState({ public: e.currentTarget.checked })} name="type" type="radio" />
                    <div>
                      <strong>Public</strong>
                      <div class="info">Make your asset available to all builders</div>
                    </div>
                  </label>
                </div>
                <div>
                  <label>
                    <input checked={!this.state.public} onClick={(e) => this.setState({ public: !e.currentTarget.checked })} name="type" type="radio" />
                    <div>
                      <strong>Private</strong>
                      <div class="info">Only you can add this asset to parcels</div>
                    </div>
                  </label>
                </div>
              </form>
            </div>
          </div>
        </section>

        {this.state.error && <Panel type="danger">{this.state.error}</Panel>}
        <button class="TakeWompButton" disabled={this.state.uploading || !this.state.name} onClick={() => this.validateAndSubmit()}>
          {this.state.uploading ? <span>Saving, please wait...</span> : <span>Submit</span>}
        </button>
      </div>
    )
  }
}

const ContentIframe = ({ content }: { content: FeatureTemplate[] }) => {
  const base64 = Buffer.from(JSON.stringify(content)).toString('base64')

  return <iframe style={{ border: 'none', outline: 'none', width: '100%' }} src={`/assets/${base64}/play?mode=orbit&encoded`}></iframe>
}

export function showCreateLibraryAsset(assetToBeShared: FeatureTemplate | string, image?: string) {
  if (!!CreateLibraryAssetWindow.currentElement) {
    unmountComponentAtNode(CreateLibraryAssetWindow.currentElement)
    CreateLibraryAssetWindow.currentElement = null
  }

  const div = document.createElement('div')
  div.className = 'pointer-lock-close'
  document.body.appendChild(div)

  render(
    <CreateLibraryAssetWindow
      assetToBeShared={assetToBeShared}
      image={image}
      onClose={() => {
        !!CreateLibraryAssetWindow.currentElement && unmountComponentAtNode(CreateLibraryAssetWindow.currentElement)
        CreateLibraryAssetWindow.currentElement = null
        div?.remove()
      }}
    />,
    div,
  )

  process.nextTick(() => (document as any).querySelector('#asset-name')['focus']())
  requestPointerLockIfNoOverlays()
}
