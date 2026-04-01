import { Component, Fragment } from 'preact'
import { Polygon } from '../../common/helpers/chain-helpers'
import { Collection, CollectionHelper } from '../../common/helpers/collections-helpers'
import CollectiblesComponent from './components/collectibles'
import { CollectionTabsNavigation } from './components/collections/collection-nav'
import CollectionSettings from './components/collections/collection-settings'
import { app, AppEvent } from './state'
import UploadWearable from './upload-wearable'

export interface Props {
  path?: string
  chain_identifier?: string
  address?: string
  id?: string
  collection?: Collection
}

export interface State {
  collection?: Collection
  listings?: Array<any>
  signedIn: boolean
}

export default class CollectionPage extends Component<Props, State> {
  constructor(props: Props) {
    super()

    // SSR
    const collection = props.collection

    this.state = {
      collection: collection,
      signedIn: false,
    }
  }

  private get isMod() {
    if (!app.signedIn) {
      return false
    }
    return app.state.moderator
  }

  private get helper() {
    return new CollectionHelper({ address: this.props.address, chain_identifier: this.props.chain_identifier })
  }

  private get isOwner() {
    if (!this.state.collection || !app.signedIn) {
      return false
    }
    return this.state.collection?.owner?.toLowerCase() == app.state.wallet?.toLowerCase()
  }

  private get isSuppressed() {
    return this.state.collection?.suppressed ?? false
  }

  private get publicCanSubmit(): boolean {
    return (!this.isDiscontinued && this.state.collection?.settings?.canPublicSubmit) ?? false
  }

  private get isDiscontinued() {
    return this.state.collection?.discontinued ?? false
  }

  onAppChange = () => {
    this.setState({ signedIn: app.signedIn })
  }

  componentDidMount() {
    app.on(AppEvent.Change, this.onAppChange)
    this.fetch()
  }

  componentWillUnmount() {
    app.removeListener(AppEvent.Change, this.onAppChange)
  }

  render() {
    if (!this.state.collection) {
      return <p>Loading...</p>
    }

    if (this.isSuppressed) {
      return (
        <section>
          <h4>This collection has been suppressed.</h4>
        </section>
      )
    }

    const imgSrc = this.state.collection?.image_url ?? `/images/default.png`

    // Id for the meta header for Server side rendering
    const metaId = this.props.chain_identifier + ':' + this.props.address?.toLowerCase()

    const collection = this.state.collection

    const isOwner = this.isOwner

    return (
      <section class="columns">
        <h1>{this.state.collection.name}</h1>

        <article>
          {isOwner && (
            <>
              <UploadWearable collection={this.state.collection} path={`/collections/${this.helper.chainIdentifier}/${this.state.collection.address}/tab/upload`} />
              <CollectionSettings collection={this.state.collection} onRefresh={this.fetch.bind(this)} path={`/collections/${this.helper.chainIdentifier}/${this.state.collection.address}/tab/admin`} />
            </>
          )}

          <CollectiblesComponent
            default
            collection={this.state.collection}
            paginationAPIName={`collections/${this.helper.chainIdentifier}/${this.state.collection.address}`}
            listings={this.state.listings}
            path={`/collections/${this.helper.chainIdentifier}/${this.state.collection.address}`}
          />
        </article>

        <aside>
          <p class="description">{this.state.collection.description}</p>

          <CollectionTabsNavigation collection={this.state.collection} />

          <dl>
            <dt>Address</dt>
            <dd>
              <a href={(this.state.collection?.chainid === Polygon ? 'https://polygonscan.com/address/' : 'https://etherscan.io/address/') + this.state.collection.address}>
                {this.state.collection?.address?.slice(0, 6) + '...' + this.state.collection?.address?.slice(-4)}
              </a>
            </dd>
            <dt>Slug</dt>
            <dd>{this.state.collection?.slug}</dd>

            <dt>Curator</dt>
            <dd>
              <a href={`/avatar/${this.state.collection.owner}`}>{this.state.collection.owner_name ? this.state.collection.owner_name : this.state.collection.owner?.substring(0, 10) + '...' || ''}</a>
            </dd>

            {collection.chainid! > 0 && (
              <Fragment>
                <dt>Blockchain</dt>
                <dd>{this.state.collection.chainid == 1 ? 'Ethereum blockchain' : 'Polygon sidechain'}</dd>
              </Fragment>
            )}

            {this.publicCanSubmit && (
              <Fragment>
                <dt>Submissions</dt>
                <dd>This collection accepts submissions</dd>
              </Fragment>
            )}

            {this.isDiscontinued && (
              <Fragment>
                <dt>Status</dt>
                <dd>This collection has been discontinued.</dd>
              </Fragment>
            )}
          </dl>

          <img src={imgSrc} />
        </aside>
      </section>
    )
  }

  private async fetch(cachebust = false) {
    const f = await fetch(`/api/collections/${this.props.id}.json`)
    const { collection } = await f.json()
    this.setState({ collection })
  }
}
