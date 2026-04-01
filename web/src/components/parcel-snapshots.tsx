/* globals fetch */
import { Component } from 'preact'
import LoadingIcon from './loading-icon'
import Modal from './modal'
import ParcelSnapshot from './parcel-snapshot'

export type ParcelSnapshotRecord = {
  id: number
  is_snapshot?: boolean
  parcel_id: number
  content: Record<string, any>
  snapshot_name?: string
  ipfs_hash?: string
  name?: string
  updated_at?: string
  created_at?: string
  content_hash?: string
}

interface Props {
  parcel: any
}

interface State {
  snapshots: ParcelSnapshotRecord[]
  takingSnapshot: boolean
  loading: boolean
  openModal: boolean
}

export default class WebParcelSnapshots extends Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = { takingSnapshot: false, loading: false, openModal: false, snapshots: [] }
  }

  componentDidMount() {
    this.fetch()
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.parcel.id != this.props.parcel.id || prevProps.parcel != this.props.parcel) {
      this.refresh()
    }
  }

  refresh() {
    this.fetch()
  }

  fetch() {
    this.setState({ loading: true, snapshots: [] })
    fetch(`${process.env.API}/parcels/${this.props.parcel.id}/snapshots.json`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          this.setState({ snapshots: r.snapshots })
        }
        this.setState({ loading: false })
      })
  }

  takeSnapshot() {
    this.setState({ takingSnapshot: true })
    return fetch(`/api/parcels/snapshot`, {
      method: 'post',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parcel_id: this.props.parcel.id }),
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          this.setState({ takingSnapshot: false }, () => {
            this.fetch()
          })
        }
      })
  }

  openModal() {
    this.setState({ openModal: true })
  }

  render() {
    const parcelSnapshots = this.state.snapshots.map((s) => {
      return <ParcelSnapshot parcel={this.props.parcel} version={s} refresh={this.refresh.bind(this)} />
    })
    return (
      <div>
        <br />
        <a href={`/parcels/${this.props.parcel.id}`}>Go back</a>
        <br />
        <h4>Snapshots</h4>
        <p>Parcels are automatically saved every edit. Snapshots are user-selected states of your parcel that you can chose to come back to later.</p>

        {!this.state.takingSnapshot ? (
          <div>
            <button
              name="snapshot"
              title="Take a snapshot of this parcel's version"
              id="snapshot"
              onClick={() => {
                this.takeSnapshot()
              }}
            >
              Take snapshot
            </button>
            <button onClick={() => this.refresh()}>Refresh</button>
          </div>
        ) : (
          'Saving snapshot...'
        )}

        <p>Snapshots for {this.props.parcel.address}:</p>
        <ul>{this.state.loading ? <LoadingIcon /> : parcelSnapshots.length > 0 ? parcelSnapshots : 'No snapshots.'}</ul>
        <a
          onClick={() => {
            this.openModal()
          }}
        >
          You can also load snapshots in-world!
        </a>
        {this.state.openModal && (
          <Modal>
            <div
              onClick={() => {
                this.setState({ openModal: false })
              }}
            >
              X
            </div>
            <h2>Interact with snapshots</h2>
            <p>To load a snapshot in-world, open the TAB menu and select the 'States' tab.</p>
            <img src="/images/tutorial-gifs/load-snapshot-inworld.gif" />
          </Modal>
        )}
      </div>
    )
  }
}
