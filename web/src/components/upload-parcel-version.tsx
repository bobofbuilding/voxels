import { Component } from 'preact'
import { render, unmountComponentAtNode } from 'preact/compat'
import type { FullParcelRecord, ParcelContentRecord } from '../../../common/messages/parcel'
import { ParcelVersionValidator } from '../helpers/parcel-version-validator'
import { AssetType, saveAsset } from '../helpers/save-helper'
import { app } from '../state'
import LoadingIcon from './loading-icon'
import Panel, { PanelType } from './panel'

export interface Props {
  parcel: FullParcelRecord | (FullParcelRecord & { spaceId: string })
  onSuccess?: () => void
}

export interface State {
  loading?: boolean
  isOk?: boolean
  error: string | null
}

export default class UploadParcelVersion extends Component<Props, State> {
  uploadDiv: HTMLDivElement = null!

  constructor(props: Props) {
    super(props)
    this.state = {
      isOk: true,
      loading: false,
      error: null,
    }
  }

  get isSpace() {
    return 'spaceId' in this.props.parcel && this.props.parcel.spaceId
  }

  uploadVersion(input: HTMLInputElement) {
    if (!input.files || !input.files[0]) {
      app.showSnackbar('No files provided', PanelType.Danger)
      return
    }

    this.setState({ loading: true, error: null })

    const fileReader = new FileReader()

    fileReader.onload = async (e: ProgressEvent<FileReader>) => {
      const c = new ParcelVersionValidator(this.props.parcel)
      let newVersion
      try {
        // This part ensures the parcel size is valid and that the parcel can be meshed properly.
        // It also removes features outside the parcel featureBounds.
        const res = e.target?.result as string
        newVersion = c.validate(res, !!this.isSpace) // Allow items outside parcel in spaces
      } catch (err: any) {
        console.error(err)
        app.showSnackbar(err.toString ? err.toString() : err, PanelType.Danger)
        this.setState({ loading: false, isOk: false, error: err.toString ? err.toString() : err })
      }

      // Tell the user some features have been removed, ask if the user wants to continue forward.
      if (
        c.featuresBeingRemoved.length &&
        !(await confirmUpload(
          `Some features are outside respectable ${this.isSpace ? 'space' : 'parcel'} boundaries and have been removed:\n ${c.featuresBeingRemoved.map((p) => p.type).join(', \n ')}. \n Do you want to keep going?`,
          this.uploadDiv,
        ))
      ) {
        this.setState({ loading: false, isOk: false })
        return
      }
      // Save new version
      if (newVersion) {
        this.saveVersion(newVersion)
      }
    }

    fileReader.onerror = () => {
      app.showSnackbar(fileReader.error?.toString(), PanelType.Danger)
      fileReader.abort()
      this.setState({ isOk: false, loading: false })
    }

    fileReader.readAsText(input.files[0])
  }

  render() {
    return (
      <div>
        {/* This extra div is important */}
        <div
          ref={(c) => {
            this.uploadDiv = c!
          }}
        >
          {this.state.loading ? <LoadingIcon /> : <input disabled={this.state.loading} type="file" name="upload-btn" id="upload-btn" accept=".json" onChange={(e) => e.target && this.uploadVersion(e.target as HTMLInputElement)} />}
        </div>
        {this.state.error && <Panel type={PanelType.Danger}>{this.state.error}</Panel>}
      </div>
    )
  }

  private async saveVersion(json: Partial<{ id: string; content: ParcelContentRecord }>) {
    if (!json.id || !json.content) {
      app.showSnackbar(`Content is invalid`, PanelType.Danger)
      return
    }

    let p
    try {
      // save asset
      p = await saveAsset(this.isSpace ? AssetType.Space : AssetType.Parcel, this.props.parcel.id, { content: json.content })
    } catch (err) {
      console.error(err)
      app.showSnackbar(err as Error, PanelType.Danger)
      this.setState({ isOk: false, loading: false })
      return
    }

    if (p.success) {
      app.showSnackbar(`Successfully uploaded your new ${this.isSpace ? 'space' : 'parcel'} content`, PanelType.Success)
      this.setState({ isOk: true })
      if (this.props.onSuccess) {
        this.props.onSuccess()
      }
    } else {
      app.showSnackbar(`Could not save your ${this.isSpace ? 'space' : 'parcel'} content`, PanelType.Danger)
      this.setState({ isOk: false })
    }
    this.setState({ loading: false })
  }
}

export async function confirmUpload(message: string, uploadDiv: HTMLDivElement): Promise<boolean | void> {
  const div = document.createElement('div')
  div.className = ''
  return new Promise(function (resolve) {
    const close = () => {
      unmountComponentAtNode(div)
      div?.remove()
    }
    const onRender = () => {}

    const onConfirm = () => {
      resolve(true)
      close()
    }
    const onCancel = () => {
      resolve(false)
      close()
    }

    uploadDiv.appendChild(div)

    render(
      <Panel type={PanelType.Warning}>
        {message}
        <br />
        <span>
          <button onClick={onCancel}>Cancel</button> <button onClick={onConfirm}>Confirm</button>
        </span>
      </Panel>,
      div,
      onRender,
    )
  })
}
