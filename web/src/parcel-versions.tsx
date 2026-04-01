import { fetchOptions } from './utils'
import { Component } from 'preact'
import EditSummary from './components/edit-summary'
import UploadParcelVersion from './components/upload-parcel-version'
import MultiRangeSlider from './components/multi-range-slider'
import { app } from './state'
import { PanelType } from './components/panel'
import Pagination from './components/pagination'
import LoadingIcon from './components/loading-icon'
import { SpacesToUpload } from './components/upload-space-to-parcel'
import ParcelHelper from '../../common/helpers/parcel-helper'
import { ChainOwnerOnly } from './components/parcels/permissions'
import { canUseDom } from '../../common/helpers/utils'
import { ParcelRecord } from '../../common/messages/parcel'

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}
export type VersionRecord = { parcel_id: number; id: number; content: any; is_snapshot: boolean; updated_at: any }

export interface Props {
  parcel?: any
  path?: string
  id?: number
  onContentChange?: () => void
}

export interface State {
  snackbarMessage?: string
  parcel?: any
  loadingParcel: boolean
  loadingVersions: boolean
  versions?: any
  summaries: []
  total: number // total # of versions
  page: number
  ascending: boolean
  saving: boolean
  minimumDate: number // minimum_date of the slider
  sliderStartDate: number // start_date of the slider
  sliderEndDate: number // end_date of the slider
}

const CV_START_TIMESTAMP = 1528113600 // in seconds the date of the very first CV parcel
export default class ParcelVersions extends Component<Props, State> {
  constructor() {
    super()

    this.state = {
      saving: false,
      loadingParcel: true,
      loadingVersions: true,
      versions: [],
      summaries: [],
      total: 100, // arbitrary default value before we fetch the actual total
      minimumDate: CV_START_TIMESTAMP, // arbitrary default value before we fetch the actual total
      sliderStartDate: CV_START_TIMESTAMP, // arbitrary default value before we fetch the actual total
      sliderEndDate: Date.now(),
      page: 1,
      ascending: false,
    }
  }

  get helper() {
    return new ParcelHelper(this.props.parcel)
  }

  async componentDidMount() {
    this.setState({ loadingVersions: true, loadingParcel: true })
    await this.fetchCount()

    if (!app.state.moderator && !this.helper.isOwner(app.state.wallet)) {
      if (canUseDom) {
        window.location.replace(`/parcels/${this.props.id}`)
      }
      return
    }

    this.setState({ loadingParcel: false })

    this.fetchHistory()
  }

  async fetchCount() {
    const p = await fetch(`${process.env.API}/parcels/${this.props.id}/history-count.json`, fetchOptions())
    const r = await p.json()

    this.setState({
      total: r.info?.count || 1,
      minimumDate: r.info?.start_date ? Date.parse(r.info?.start_date) / 1000 : CV_START_TIMESTAMP,
    })
  }

  async fetchHistory(cachebust = false) {
    this.setState({ loadingVersions: true })
    const url = `${process.env.API}/parcels/${this.props.id}/history.json?limit=50&page=${this.state.page! - 1}&asc=${this.state.ascending}&start_date=${this.state.sliderStartDate}&end_date=${this.state.sliderEndDate}${
      cachebust ? `&cb=${Date.now()}` : ''
    }`

    fetch(url, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        this.setState({ versions: r.versions, loadingVersions: false })
      })
  }

  async revertTo(version: any) {
    console.log(version)
    const p = await fetch(`${process.env.API}/parcels/${version.parcel_id}/revert`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ parcel_version_id: version.id }),
    })
    const r = await p.json()
    if (r.success) {
      app.showSnackbar('Parcel was reverted', PanelType.Success)
      this.onChange()
    } else {
      console.error(r)
      app.showSnackbar('Something went wrong, please try again', PanelType.Danger)
    }
  }

  setVersionAsSnapshot = async (version: VersionRecord) => {
    this.setState({ loadingVersions: true })
    return fetch(`/api/parcels/snapshot`, {
      method: 'post',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...version }),
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          this.fetchHistory(true)
        }
        this.setState({ loadingVersions: false })
      })
      .catch(() => {
        this.setState({ loadingVersions: false })
      })
  }

  hideReverting() {
    this.setState({ saving: false })
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.ascending !== prevState.ascending) {
      this.fetchHistory()
      return
    }
    if (this.state.page !== prevState.page) {
      this.fetchHistory()
      return
    }
  }

  toggleAscending = async () => {
    this.setState({
      ascending: !this.state.ascending,
    })
  }

  setpage = (page: number) => {
    this.setState({ page })
  }

  onChange = () => {
    this.fetchHistory(true)
    this.props.onContentChange && this.props.onContentChange()
  }

  onSliderDateChange = (dict: { min: number; max: number }) => {
    this.setState({ sliderStartDate: Math.round(dict.min), sliderEndDate: Math.round(dict.max) }, () => {
      this.fetchHistory()
    })
  }

  nerfHistory = async () => {
    if (!confirm('This will erase all previous versions of this parcel, do you want to continue?')) {
      return
    }
    const p = await fetch(`${process.env.API}/parcels/${this.props.id}/history`, { method: 'DELETE', headers, credentials: 'include' })
    const r = await p.json()
    if (r.success) {
      app.showSnackbar('History was cleared!', PanelType.Success)
      this.onChange()
    } else {
      console.error(r)
      app.showSnackbar('Something went wrong, please try again', PanelType.Danger)
    }
  }

  render() {
    const summaries = []

    for (let i = 0; i < this.state.versions.length; i++) {
      const prior = this.state.versions[i + 1] || {}
      summaries.push(
        <EditSummary
          version={this.state.versions[i]}
          setAsSnapshot={this.setVersionAsSnapshot}
          prior={prior}
          small={false}
          onRevert={() => this.revertTo(this.state.versions[i])}
          createSpaceFromVersion={createSpaceFromVersion.bind(this, this.props.parcel)}
        />,
      )
    }

    return (
      <section>
        <h3>Parcel version management</h3>
        <p>
          <a href={!this.state.loadingParcel ? `/parcels/${this.props.parcel.id}` : '#'}> {'<-'} Return to parcel page</a>
        </p>

        <section>
          <div>
            <header>
              <h3>Parcel Versions for {!this.state.loadingParcel && <a href={`/parcels/${this.props.parcel.id}`}>{this.props.parcel.name || this.props.parcel.address}</a>}</h3>
              <p>All changes to this parcel.</p>
            </header>
            <div>
              <div>
                <p>Here you can see changes to this parcel, download that version for safekeeping and revert the parcel to a time in the past.</p>
              </div>
              <div>
                <hr />
                <b>Sorting options:</b>
                <div style={{ display: 'flex' }}>
                  <div style={{ flexGrow: 1 }}>
                    <label>
                      Time range:
                      <MultiRangeSlider min={this.state.minimumDate} defaultMin={this.state.sliderStartDate} max={Date.now() / 1000} onChange={this.onSliderDateChange} />
                    </label>
                  </div>
                </div>
                <label>
                  <input type="checkbox" onChange={this.toggleAscending} checked={!!this.state.ascending} />
                  Ascending
                </label>
                <hr />
              </div>
              {!this.state.loadingVersions && (
                <div>
                  <Pagination url="parcels" page={this.state.page} perPage={50} total={this.state.total} callback={this.setpage} />
                </div>
              )}
              <div>{this.state.loadingVersions ? <p>Loading versions...</p> : summaries}</div>
            </div>
            {!this.state.loadingVersions && (
              <div>
                <Pagination url="parcels" page={this.state.page} perPage={50} total={this.state.total} callback={this.setpage} />
              </div>
            )}
          </div>
          <aside>
            <div>
              <header>
                <h3>Spaces</h3>
                <p>Upload a JSON from a space of similar size.</p>
              </header>
              <div>
                {this.state.loadingParcel ? (
                  <span>
                    <LoadingIcon />
                  </span>
                ) : (
                  <SpacesToUpload parcel={this.props.parcel} onSuccess={this.onChange} />
                )}
              </div>
            </div>
            <div>
              <header>
                <h3>Import</h3>
                <p>Upload a JSON and change this parcel's content.</p>
              </header>
              <div>
                {this.state.loadingParcel ? (
                  <span>
                    <LoadingIcon />
                  </span>
                ) : (
                  <UploadParcelVersion parcel={this.props.parcel} onSuccess={this.onChange} />
                )}
              </div>
            </div>
            <ChainOwnerOnly parcel={this.props.parcel}>
              <div>
                <header>
                  <h3>Danger zone</h3>
                  <p>You know what you're doing.</p>
                </header>

                <div>
                  <label>
                    <button onClick={this.nerfHistory}>Clear parcel history</button>
                    <br />
                    This will delete all non-snapshot versions of this parcel
                  </label>
                </div>
              </div>
            </ChainOwnerOnly>
          </aside>
        </section>
      </section>
    )
  }
}

export const createSpaceFromVersion = async (parcel: ParcelRecord, version: VersionRecord) => {
  const helper = new ParcelHelper(parcel)
  const cleanContent = Object.assign(version.content)
  delete cleanContent.settings // rmeove legacy settings

  const body = JSON.stringify({
    name: `Copy ${version.id} of parcel ${version.parcel_id}`,
    width: helper.width,
    depth: helper.depth,
    height: helper.height,
    content: cleanContent,
  })

  const p = await fetch(`/spaces/create`, { method: 'POST', headers, credentials: 'include', body })
  const r = await p.json()
  if (r.success) {
    app.showSnackbar('Space was created!', PanelType.Success)
    window.location.href = `/spaces/${r.id}`
  } else {
    console.error(r)
    app.showSnackbar('Something went wrong, please try again', PanelType.Danger)
  }
}
