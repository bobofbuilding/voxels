import { Component } from 'preact'
import { SUPPORTED_CHAINS_BY_ID } from '../../../../common/helpers/chain-helpers'
import { Collection } from '../../../../common/helpers/collections-helpers'
import { app } from '../../state'

export interface Props {
  collection: Collection
  small?: boolean
}

export interface State {}

export default class CollectionItem extends Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {}
  }

  get collection() {
    return this.props.collection
  }

  get canPublicSubmit() {
    return !!this.collection && !!this.collection.settings && !!this.collection.settings.canPublicSubmit
  }

  get isOwner() {
    return this.collection.owner && this.collection.owner.toLowerCase() == app.state.wallet?.toLowerCase()
  }

  componentDidMount() {}

  relocate() {
    window.location.href = `/collections/${SUPPORTED_CHAINS_BY_ID[this.collection.chainid?.toString() ?? '0']}/${this.collection.address}`
  }

  render() {
    const src = this.collection.image_url || `/images/default.png`

    return (
      <tr key={this.collection.id}>
        <td>
          <a href={`/collections/${this.collection.id}`}>{this.collection.name}</a>
          <br />
          <small>{this.collection.description}&nbsp;</small>
        </td>
        <td>{this.collection.total_wearables}</td>
        <td>{SUPPORTED_CHAINS_BY_ID[this.collection.chainid?.toString() ?? '0']}</td>
      </tr>
    )
  }
}
