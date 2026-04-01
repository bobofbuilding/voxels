import { Component } from 'preact'
import CreateCollection from './create-collection'
import { app } from './state'

interface State {
  tab: string
  balanceOfParcels: number
  numCollections: number
  showBalanceParcels: boolean
}

export default class NewCollection extends Component<any, State> {
  constructor() {
    super()

    this.state = {
      balanceOfParcels: 0,
      showBalanceParcels: false,
      numCollections: 0,
      tab: 'introduction',
    }
  }

  get isMod() {
    if (!app.signedIn) {
      return false
    }
    return app.state.moderator
  }

  get canCreateCollection() {
    return (this.state.balanceOfParcels > 0 && this.state.balanceOfParcels > this.state.numCollections) || this.isMod
  }

  componentDidMount() {
    // fetch number of collections made by the user already.
    this.fetchCollectionsByUser()
    this.fetchParcelsBalance()
  }

  fetchCollectionsByUser() {
    if (!app.signedIn) {
      return
    }
    fetch(`${process.env.API}/collections/owned/by/${app.state.wallet}.json`)
      .then((r) => r.json())
      .then((r) => {
        if (!r.success) {
          this.setState({ numCollections: 0 })
          return
        }
        // Take out collections that have been discontinued.
        const trueCollections = r.collections.filter((c: any) => !c.discontinued)
        this.setState({ numCollections: trueCollections.length })
      })
  }

  fetchParcelsBalance() {
    if (!app.signedIn) {
      return
    }
    fetch(`${process.env.API}/avatar/${app.state.wallet}/parcels-count.json`)
      .then((r) => r.json())
      .then((r) => {
        if (!r.success) {
          this.setState({ balanceOfParcels: 0 })
          return
        }
        // Take out collections that have been discontinued.
        this.setState({ balanceOfParcels: r.parcels })
      })
  }

  openModal() {
    this.setState({ showBalanceParcels: true })
  }

  closeModal(modal: string) {
    const state = {}
    ;(state as any)[modal] = false
    this.setState(state)
  }

  render() {
    if (!app.signedIn) {
      return <div />
    }

    return (
      <section>
        <head>
          <title>Voxels - New Collection</title>

          <meta property="og:type" content="website"></meta>
          <meta property="og:url" content="https://www.voxels.com/collections"></meta>
          <meta property="og:title" name="twitter:title" content="Voxels - Collections"></meta>
          <meta property="og:description" name="twitter:description" content="List of collections"></meta>
          <meta name="twitter:card" content="summary" />
        </head>
        <br />
        <div>
          <h3>Create a collection</h3>

          <p>
            You can create a collection for every parcel you own.
            {this.state.balanceOfParcels > 0 && (
              <span>
                You own {this.state.balanceOfParcels} parcels, and have created {this.state.numCollections} collections.
              </span>
            )}
            {this.state.balanceOfParcels == 0 && !this.isMod && <span>You do not own any parcels</span>}
          </p>

          {this.canCreateCollection && <CreateCollection />}
        </div>
      </section>
    )
  }
}
