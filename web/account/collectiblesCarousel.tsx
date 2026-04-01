import { Component } from 'preact'
import { app } from '../src/state'
import CollectibleCard from './collectibleCard'
import { CollectibleInfoRecord, CollectibleRecord } from '../../common/messages/collectibles'
import { fetchUsersCollectibles } from '../../common/helpers/collections-helpers'
import { PanelType } from '../src/components/panel'
import { fetchAPI } from '../src/utils'
import { Spinner } from '../src/spinner'

interface CollectiblesCarouselProps {
  loaded?: boolean
  wearables?: CollectibleRecord[]
  numberToShow?: number
  collapsed?: boolean
  className?: string
  smallCards?: boolean
  wallet?: string
  cacheBust?: boolean
}

interface CollectiblesCarouselState {
  loaded: boolean
  wearables: CollectibleInfoRecord[]
  numberToShow: number
  collapsed: boolean
}

abstract class CollectiblesCarousel extends Component<CollectiblesCarouselProps, CollectiblesCarouselState> {
  constructor(props: CollectiblesCarouselProps) {
    super()
    this.state = {
      loaded: props.loaded || false,
      numberToShow: props.numberToShow || 20,
      collapsed: props.collapsed ?? true,
      wearables: [],
    }
  }

  componentDidMount() {
    this.fetchWearables()
  }

  componentDidUpdate(prevProps: CollectiblesCarouselProps, prevState: CollectiblesCarouselState) {
    if (prevState == this.state && this.props.cacheBust) {
      this.fetchWearables()
    }
  }

  fetchWearables() {
    const wallet = this.props.wallet || app.state.wallet
    if (!wallet) {
      return Promise.reject(new Error('cannot fetch collectibles, no wallet detected'))
    }
    this.setState({ loaded: false })
    this.getWearables(wallet)
      .then((wearables) => {
        this.setState({ wearables: wearables, loaded: true })
      })
      .catch((err) => {
        this.setState({ wearables: [], loaded: false })
        app.showSnackbar(err.message, PanelType.Danger)
      })
  }

  abstract getWearables(wallet: string, cacheBuster?: boolean): Promise<CollectibleInfoRecord[]>

  showMore = () => {
    this.setState({ numberToShow: this.state.numberToShow + 40 })
  }

  render() {
    if (!this.state.loaded) return <Spinner size={24} />

    const wearablesOwned = this.state.wearables?.slice(0, this.state.numberToShow).map((c) => <CollectibleCard openInSameWindow={true} collectible={c} />)

    const showMore = wearablesOwned.length >= this.state.numberToShow
    // NO Cards
    if (!wearablesOwned.length) {
      return (
        <div>
          <p>Collectibles</p>
          {!this.props.wallet || this.props.wallet === app.state.wallet ? <p>None</p> : <p>None found</p>}
        </div>
      )
    } else {
      // EXPANDED LIST
      return (
        <div>
          <div class="wearables">{wearablesOwned}</div>
          <div>{showMore && <button onClick={() => this.showMore()}>Show More</button>}</div>
        </div>
      )
    }
  }
}

export class UserOwns extends CollectiblesCarousel {
  override getWearables(wallet: string): Promise<CollectibleInfoRecord[]> {
    return fetchUsersCollectibles(wallet).then((wearables) => {
      if (!wearables) throw new Error('There was an error while refreshing your collectibles')
      return wearables
    })
  }
}

export class UserCreated extends CollectiblesCarousel {
  override getWearables(wallet: string, cacheBust?: boolean): Promise<CollectibleInfoRecord[]> {
    const searchParams = new URLSearchParams({
      q: wallet,
      asc: 'false',
      sort: 'updated_at',
      force_update: `${!!cacheBust}`,
    })
    return fetchAPI(`/api/collectibles.json?${searchParams}`).then((wearables) => {
      if (!wearables?.collectibles) throw new Error('There was an error while refreshing your collectibles')
      return wearables.collectibles
    })
  }
}
