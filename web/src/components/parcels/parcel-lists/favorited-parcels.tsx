import { sortBy } from 'lodash'
import ParcelHelper from '../../../../../common/helpers/parcel-helper'
import { Spinner } from '../../../spinner'
import { app } from '../../../state'
import PropertyItem from '../../property-item'
import ParcelList from './parcel-list'

export default class AllFavoritedParcels extends ParcelList {
  constructor() {
    super()
  }

  /**
   * fetch parcels using a different api given the type of ownership.
   */
  fetchParcels = () => {
    this.fetchFavoriteParcels()
  }

  fetchFavoriteParcels() {
    this.setState({ parcelsFetched: false })
    fetch(`${process.env.API}/favorites/${app.state.wallet}.json${this.shouldCacheBust()}`)
      .then((r) => r.json())
      .then((r) => {
        const parcels = r.parcels || []

        this.setState({ parcels, parcelsFetched: true })
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

  render() {
    const parcels = this.getParcelsSorted().map((p: any) => {
      p.isFavorite = true
      return <PropertyItem key={p.id} record={p} helper={new ParcelHelper(p)} teleportTo={this.props.teleportTo} />
    })

    return (
      <div>
        <h3>Favorites</h3>

        {this.state.parcelsFetched ? <p> You favorited {this.state.parcels.length} parcels. </p> : <Spinner size={24} bg={'dark'} />}

        {this.state.parcels.length > 0 ? (
          <div>
            Sort by:
            <button className={this.state.sort == 'id' && (`active ${this.state.ascending ? 'up' : 'down'}` as any)} onClick={() => this.toggleSort('id')}>
              Parcel ID
            </button>
            <button className={this.state.sort == 'footprint' && (`active ${this.state.ascending ? 'up' : 'down'}` as any)} onClick={() => this.toggleSort('footprint')} title="Ground footprint (cm^2)">
              Footprint
            </button>
            <button className={this.state.sort == 'island' && (`active ${this.state.ascending ? 'up' : 'down'}` as any)} onClick={() => this.toggleSort('island')} title="Island in the world">
              Island
            </button>
            <button className={this.state.sort == 'suburb' && (`active ${this.state.ascending ? 'up' : 'down'}` as any)} onClick={() => this.toggleSort('suburb')} title="Distance from center of world">
              Neighborhood
            </button>
            <button className={this.state.sort == 'height' && (`active ${this.state.ascending ? 'up' : 'down'}` as any)} onClick={() => this.toggleSort('height')} title="Building height limit">
              Height
            </button>
            <button className={this.state.sort == 'distance' && (`active ${this.state.ascending ? 'up' : 'down'}` as any)} onClick={() => this.toggleSort('distance')} title="Distance from center of world">
              Distance
            </button>
            <table>
              <tbody>{parcels}</tbody>
            </table>
          </div>
        ) : (
          <div />
        )}
      </div>
    )
  }
}
