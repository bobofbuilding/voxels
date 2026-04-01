import { Component } from 'preact'
import { app } from '../src/state'
import CollectionItem from '../src/components/collections/collections-item'
import { UserCreated, UserOwns } from './collectiblesCarousel'
import { Collection } from '../../common/helpers/collections-helpers'
import BatchTransfer from '../src/popup-ui/batch-transfer-nft'
import { fetchAPI } from '../src/utils'
import { Spinner } from '../src/spinner'

export interface State {
  status: string | null
  update: boolean
}

export default class AccountCollectibles extends Component<object, State> {
  constructor() {
    super()
    this.state = { status: null, update: false }
  }

  componentDidMount() {
    if (!app.signedIn) {
      window.location.href = '/'
    }
  }

  async refreshCollectibles() {
    this.setState({ update: true })
    this.forceUpdate()
  }

  render() {
    return (
      <section class="columns">
        <h1>Collectibles</h1>

        <article>
          <h2>Collectibles Owned</h2>
          <UserOwns cacheBust={this.state.update} />
        </article>

        <aside>
          <h2>Collectibles Created</h2>
          <UserCreated cacheBust={this.state.update} />

          <h2>Collections</h2>

          <UserCollections cacheBust={this.state.update} />

          <BatchTransfer />
        </aside>
      </section>
    )
  }
}

type UserCollectionsProps = {
  cacheBust: boolean
  wallet?: string
}

type UserCollectionsState = {
  loaded: boolean
  collections: Collection[]
}

export class UserCollections extends Component<UserCollectionsProps, UserCollectionsState> {
  state: UserCollectionsState = {
    loaded: false,
    collections: [],
  }

  componentDidMount() {
    this.fetchCollections()
  }

  componentDidUpdate(prevProps: UserCollectionsProps, prevState: UserCollectionsState) {
    if (prevState == this.state && this.props.cacheBust) {
      this.fetchCollections(true)
    }
  }

  fetchCollections(cacheBust = false) {
    this.setState({ loaded: true })
    fetchAPI(`/api/collections/owned/by/${app.state.wallet}.json` + (cacheBust ? `?cb=${Date.now()}` : '')).then((r) => {
      this.setState({ collections: r.collections || [], loaded: false })
    })
  }

  render() {
    if (this.state.loaded) return <Spinner size={24} />

    const collections = this.state.collections.map((c) => <CollectionItem collection={c} />)
    return this.state.collections.length > 0 ? (
      <div>
        <div>{collections}</div>
        <div>
          <a href="/marketplace/new">Create a new collection</a>
        </div>
      </div>
    ) : (
      <div>
        <p>Collections</p>
        {!this.props.wallet || this.props.wallet === app.state.wallet ? (
          <p>
            <a href="/marketplace/new">Create a collection</a> to manage and mint wearables.
          </p>
        ) : (
          <p>No collections found</p>
        )}
      </div>
    )
  }
}
