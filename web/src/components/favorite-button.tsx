import { Component } from 'preact'
import { app, AppEvent } from '../state'
import { fetchAPI, fetchOptions } from '../utils'
import { PanelType } from './panel'
import { invalidateUrl } from '../helpers/cached-fetch'
import { ssrFriendlyDocument } from '../../../common/helpers/utils'

type Props = {
  parcelId: number
}

type State = {
  fetched: boolean
  fetching: boolean
  isFavorite: boolean
}

export default class FavoriteButton extends Component<Props, State> {
  state: State = {
    fetched: false,
    fetching: false,
    isFavorite: false,
  }

  get isFavorite(): boolean {
    return this.state.isFavorite
  }

  get postBody() {
    return JSON.stringify({ parcel_id: this.props.parcelId })
  }

  componentDidMount() {
    this.fetch()
    app.on(AppEvent.Login, this.fetch.bind(this))
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.parcelId !== prevProps.parcelId) {
      this.fetch()
    }
  }

  invalidateFavorites() {
    const url = `/api/favorites/${app.state.wallet}.json`
    invalidateUrl(url)
  }

  fetch() {
    const isSpace = (): boolean => !!ssrFriendlyDocument?.location.toString()?.match('/spaces')
    if (isSpace()) {
      return
    }

    if (!app.signedIn) {
      return
    }
    this.setState({ fetching: true })
    fetchAPI(`/api/favorites/${app.state.wallet}/${this.props.parcelId}.json?cb=${Date.now()}`).then((result) => {
      this.setState({ isFavorite: !!result.isFavorite, fetching: false, fetched: true })
    })
  }

  async addFavorite() {
    if (!this.state.fetched) {
      return
    }
    this.setState({ isFavorite: true })
    fetchAPI(`/api/favorites/add`, fetchOptions(undefined, this.postBody))
      .catch((err) => {
        app.showSnackbar(`Could not add parcel ${this.props.parcelId} as favorite.`, PanelType.Danger)
        this.setState({ isFavorite: false })
        console.error(err)
      })
      .finally(() => {
        this.invalidateFavorites()
      })
  }

  async removeFavorite() {
    if (!this.state.fetched) {
      return
    }
    this.setState({ isFavorite: false })
    fetchAPI(`/api/favorites/remove`, fetchOptions(undefined, this.postBody))
      .catch((err) => {
        console.error(err)
        app.showSnackbar(`Could not remove parcel ${this.props.parcelId} from your favorite`, PanelType.Danger)
        this.setState({ isFavorite: true })
      })
      .finally(() => {
        this.invalidateFavorites()
      })
  }

  render() {
    if (!app.signedIn) {
      return null
    }

    if (this.state.fetching) {
      return <a class="favorite-button inactive">⭐️</a>
    }

    const fav = this.isFavorite

    const toggle = () => {
      fav ? this.removeFavorite() : this.addFavorite()
    }

    return (
      <a class={'favorite-button ' + (fav ? 'active' : 'inactive')} onClick={toggle} title={fav ? 'Remove from your favorites.' : 'Add to your favorites'}>
        ⭐️
      </a>
    )
  }
}
