import { Component } from 'preact'

export interface Props {
  teleportTo?: (coords: string) => void
  query?: string
}

export default class ParcelList extends Component<Props, any> {
  constructor() {
    super()
    this.state = { parcels: [], parcelsFetched: false, sort: 'id', ascending: true }
  }

  /**
   * fetch parcels using a different api given the type of ownership.
   */
  fetchParcels = () => {}

  shouldCacheBust() {
    return this.state.parcels ? `?cb=${Date.now()}` : ''
  }

  componentDidMount() {
    this.fetchParcels()
  }

  toggleSort(field: any, callback?: Function) {
    if (this.state.sort === field) {
      this.setState({
        ascending: !this.state.ascending,
      })
    } else {
      this.setState({
        sort: field,
        ascending: false,
      })
    }
    callback?.()
  }

  render(): any {
    return null
  }
}
