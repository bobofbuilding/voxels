import { isEqual, omit } from 'lodash'
import { Component, Fragment } from 'preact'
import { format } from 'timeago.js'
import config from '../../../common/config'
import ParcelHelper from '../../../common/helpers/parcel-helper'
import { uploadJSONToIPFS } from '../../../common/helpers/upload-media'
import { ApiStatusResponse } from '../../../common/messages/api-parcels'
import { validateMessageResponse } from '../../../common/messages/validate'
import { saveSnapshot } from '../helpers/save-helper'
import { app } from '../state'
import { AssetType } from './Editable/editable'
import EditableName from './Editable/editable-name'
import { PanelType } from './panel'
import { ParcelSnapshotRecord } from './parcel-snapshots'

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

interface Props {
  parcel?: any
  version: ParcelSnapshotRecord
  refresh?: Function
}

interface State {
  snapshot_name?: string
  percentageBuilt?: number
  countFeatures?: number
  saving?: boolean
  uploading?: boolean
  remove?: boolean
  isAutosave?: boolean
  parcel?: any
  ipfsHash?: string
}

export default class ParcelSnapshot extends Component<Props, State> {
  helper: ParcelHelper = undefined!

  constructor(props: Props) {
    super(props)
    this.state = {
      saving: false,
      uploading: false,
      remove: false,
      parcel: props.parcel,
      isAutosave: !props.version.is_snapshot,
      ipfsHash: props.version.ipfs_hash,
    }
  }

  get parcel() {
    return this.state.parcel
  }

  get isOwner() {
    return this.parcel && this.parcel.owner.toLowerCase() === app.state.wallet?.toLowerCase()
  }

  setHelper() {
    // The props are a confusing to work with so we create our own parcel object to guarantee its definition.
    const p = Object.assign({}, this.parcel)
    p.content = this.props.version.content
    this.helper = new ParcelHelper({
      x1: p.x1,
      x2: p.x2,
      y1: p.y1,
      y2: p.y2,
      z1: p.z1,
      z2: p.z2,
      height: p.y2,
      distance_to_center: p.distance_to_center,
      distance_to_ocean: p.distance_to_ocean,
      distance_to_closest_common: p.distance_to_closest_common,
      content: p.content,
      geometry: p.geometry,
    })
    return p
  }

  setStateAsync(state: State): Promise<void> {
    return new Promise((resolve) => {
      this.setState(state, resolve)
    })
  }

  uploadToIPFS = async () => {
    this.setStateAsync({ uploading: true })
    const body = {
      id: this.props.version.id,
      parcel_id: this.props.version.parcel_id,
      content: this.props.version.content,
      name: this.props.version.name,
    }

    const upload = await uploadJSONToIPFS(body)

    if (upload && upload.hash) {
      const v = Object.assign({}, { version: { id: this.props.version.id } }, { ipfs_hash: upload.hash })
      const p = await saveSnapshot(v)

      if (p.success) {
        app.showSnackbar('Uploaded version to IPFS!')
      }
      this.setState({ ipfsHash: upload.hash })
    }
    this.setStateAsync({ uploading: false })
  }

  async componentDidMount() {
    await this.setStateAsync({ parcel: this.props.parcel })
    this.setHelper()
    this.setState({
      snapshot_name: this.props.version.snapshot_name || 'Snapshot',
      countFeatures: this.props.version.content.features?.length || 0,
      percentageBuilt: parseFloat(this.helper.percentageBuilt || '0'),
    })
  }

  revertTo() {
    if (!confirm('Are you sure you want to revert to version #' + this.props.version.id + ': ' + this.state.snapshot_name)) {
      return
    }
    this.save(this.props.version.content)
  }

  async revertToParcelVersion() {
    await this.setStateAsync({ saving: true })
    const p = await fetch(`${process.env.API}/parcels/${this.props.version.parcel_id}/revert`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ parcel_version_id: this.props.version.id }),
    })

    const r = await validateMessageResponse(ApiStatusResponse)(p)
    if (r.success) {
      setTimeout(() => {
        this.setState({ saving: false })
        this.props.refresh && this.props.refresh()
      }, 1500)
    } else {
      this.setState({ saving: false })
      console.error(r)
      app.showSnackbar(r.message || 'Something went wrong, please try again', PanelType.Danger)
    }
  }

  save(content?: Record<string, any>) {
    if (!content) {
      alert('No content')
      return
    }
    this.setState({ saving: true })

    return fetch(`/grid/parcels/${this.parcel.id}`, {
      method: 'put',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    })
      .then(validateMessageResponse(ApiStatusResponse))
      .then((r: ApiStatusResponse) => {
        if (!r.success) {
          alert('Error reverting.\n\nPlease jump on discord and report the error.')
        }
        // time out for the sake of UX
        setTimeout(() => {
          this.setState({ saving: false })
          this.props.refresh && this.props.refresh()
        }, 1500)
      })
  }

  remove() {
    if (!confirm('Are you sure you want to remove Snapshot ' + this.props.version.snapshot_name)) {
      return
    }
    this.setState({ saving: true })

    return fetch(`/api/parcels/snapshot/remove`, {
      method: 'post',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: this.props.version }),
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          this.setState({ remove: true })
          this.props.refresh && this.props.refresh()
        }
        this.setState({ saving: false })
      })
      .catch(() => {
        this.setState({ saving: false, remove: false })
      })
  }

  isCurrent() {
    // check whether version is same as current parcel
    // The version attribute causes problems on some features so we omit it.
    const parcelContent = {
      features:
        this.parcel.content.features?.map((f: any) => {
          return omit(f, 'version')
        }) || [],
      palette: this.parcel.content.palette,
      scripting: this.parcel.content.scripting,
      tileset: this.parcel.content.tileset,
      voxels: this.parcel.content.voxels,
      brightness: this.parcel.content.brightness || null,
    }

    const versionContent = Object.assign({}, this.props.version.content)
    versionContent.brightness = versionContent.brightness || null //make sure we have a brightness property
    versionContent.features =
      versionContent.features?.map((f: any) => {
        return omit(f, 'version')
      }) || []
    return isEqual(versionContent, parcelContent)
  }

  render({}: any, { uploading }: State) {
    if (!this.state.snapshot_name) {
      return <li></li>
    }
    if (this.state.remove) {
      return null
    }
    return (
      <li>
        <div>
          <header>
            <div>
              <small>#{this.props.version.id}</small>
              {this.state.isAutosave ? (
                <div>
                  <em>autosave</em>
                </div>
              ) : (
                <EditableName value={this.state.snapshot_name} isowner={this.isOwner} type={AssetType.Snapshot} data={this.props.version} title="Name of this snapshot" />
              )}
            </div>
            <div>
              {this.state.parcel && !this.isCurrent() ? (
                <button
                  onClick={() => {
                    !this.state.saving && this.revertToParcelVersion()
                  }}
                >
                  {this.state.saving ? 'Reverting..' : `Revert to ${this.state.isAutosave ? 'autosave' : 'snapshot'}`}
                </button>
              ) : (
                <span>Is current</span>
              )}
            </div>
          </header>
          <small>
            {format(this.props.version.created_at || Date.now().toString())} - {this.state.countFeatures} features - {!!this.state.percentageBuilt && `${(this.state.percentageBuilt * 100).toFixed(2)}% voxels built `}
            {!this.state.isAutosave && (
              <Fragment>
                - <a onClick={() => this.remove()}>Remove</a> -{' '}
                {!!this.state.ipfsHash ? (
                  <a href={`${config.proxy_base_url}/ipfs/${this.state.ipfsHash}`} target="_blank" title="Click to see on IPFS">
                    On IPFS
                  </a>
                ) : !!uploading ? (
                  <a>Loading ...</a>
                ) : (
                  <a onClick={() => this.uploadToIPFS()}>Upload to IPFS</a>
                )}
              </Fragment>
            )}
          </small>
        </div>
      </li>
    )
  }
}
