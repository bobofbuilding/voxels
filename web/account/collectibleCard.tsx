import { Component } from 'preact'
import WearableHelper from '../src/helpers/collectible'
import { format } from 'timeago.js'
import { CollectibleInfoRecord, CollectibleRecord } from '../../common/messages/collectibles'
import { route } from 'preact-router'

interface collectibleProps {
  collectible: CollectibleInfoRecord | CollectibleRecord
  className?: string
  openInSameWindow?: boolean
}

interface collectibleState {
  collectible: CollectibleInfoRecord | CollectibleRecord
}

export default class CollectibleCard extends Component<collectibleProps, collectibleState> {
  constructor(props: collectibleProps) {
    super()
    this.state = { collectible: props.collectible }
  }

  get collectible() {
    return new WearableHelper(this.state.collectible)
  }

  componentDidMount() {
    if ('name' in this.props.collectible && this.props.collectible.id) {
      // we gave the card a collectible with already all the info.
      return
    }
    this.fetchCollectiblesData()
  }

  async fetchCollectiblesData() {
    // To do: reconcile the type of CollectionHelper and CollectibleRecord
    const helper = this.collectible
    const res = await helper.fetchMetaData()

    if (!res) {
      return
    }

    this.setState({ collectible: helper.summary() })
  }

  redirect() {
    route(this.collectible.collectiblePage())
  }

  render() {
    if (this.collectible.isSuppressed()) {
      return <div />
    }

    const href = `/assets/${this.collectible.id}`

    return (
      <div class="wearable" key={this.collectible.id}>
        <a href={href}>
          <img loading="lazy" src={this.collectible.gif()} />
          <p>{this.collectible.name || '...'}</p>
        </a>
      </div>
    )
  }
}
