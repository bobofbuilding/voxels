import { sortBy } from 'lodash'
import { Component } from 'preact'
import ParcelHelper from '../../common/helpers/parcel-helper'
import { loadingBox } from '../src/components/loading-icon'
import PropertyItem from '../src/components/property-item'
import cachedFetch from '../src/helpers/cached-fetch'

const TTL = 60

export interface Props {
  wallet?: string
  cacheBust?: boolean
  isOwner?: boolean
}

export interface State {
  parcels: any
  sort: string
  ascending: boolean
  showAll: boolean
  loading: boolean
}

export class Favorites extends Component<Props, State> {
  constructor() {
    super()

    this.state = { parcels: [], showAll: false, loading: false, sort: 'id', ascending: true }
  }

  componentDidMount() {
    this.fetch()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevState == this.state && this.props.cacheBust) {
      this.fetch()
    }
  }

  fetch() {
    this.setState({ loading: true })

    cachedFetch(`${process.env.API}/favorites/${this.props.wallet}.json`, {}, TTL)
      .then((r) => r.json())
      .then((r) => {
        const parcels = r.parcels || []
        parcels.reverse()

        this.setState({ parcels, loading: false })
      })
  }

  getParcelsSorted() {
    const result = sortBy(this.state.parcels, (p: any) => {
      const h = new ParcelHelper(p)

      switch (this.state.sort) {
        case 'id':
          return parseInt(p.id, 10)
        case 'footprint':
          return Math.abs((h.x2 - h.x1) * (h.z2 - h.z1))
        case 'owner':
          return p.ownerName
        case 'suburb':
          return p.suburb
        case 'height':
          return parseInt(p.height, 10)
        case 'distance':
          return h.distance_to_center
        case 'island':
          return p.island
      }
    })

    if (!this.state.ascending) {
      result.reverse()
    }

    return result
  }

  toggleSort(field: any) {
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
  }

  toggleShowAll() {
    this.setState({ showAll: !this.state.showAll })
  }

  render() {
    if (this.state.loading) {
      return loadingBox()
    }

    const showTheseMany = 10
    const parcels = this.state.parcels.slice(0, this.state.showAll ? this.state.parcels.length : showTheseMany).map((p: any) => <PropertyItem record={p} helper={new ParcelHelper(p)} />)

    const hint = this.props.isOwner ? '' : <p>Favorited parcels show here</p>

    return (
      <div>
        <div>
          {this.state.parcels.length > 0 ? (
            <table>
              <tbody>{parcels}</tbody>
            </table>
          ) : (
            hint
          )}
        </div>
      </div>
    )
  }
}
