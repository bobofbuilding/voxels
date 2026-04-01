import { sortBy } from 'lodash'
import ParcelHelper from '../../../../../common/helpers/parcel-helper'
import { Spinner } from '../../../spinner'
import { app } from '../../../state'
import { fetchOptions } from '../../../utils'
import PropertyItem from '../../property-item'
import ParcelList from './parcel-list'

export default class AllOwnedParcels extends ParcelList {
  constructor() {
    super()
  }

  /**
   * fetch parcels using a different api given the type of ownership.
   */
  fetchParcels = () => {
    this.fetchOwnedParcels().catch(console.error)
  }

  async fetchOwnedParcels() {
    this.setState({ parcelsFetched: false })
    const r = await fetch(`${process.env.API}/wallet/${app.state.wallet}/parcels.json${this.shouldCacheBust()}`)
    const r_1 = await r.json()
    const parcels = r_1.parcels || []
    this.setState({ parcels, parcelsFetched: true })
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

  refresh = async () => {
    this.setState({ parcelsFetched: false }, () => {
      fetch(`${process.env.API}/parcels/by/${app.state.wallet}/query`, fetchOptions())
        .then((p) => p.json())
        .then((r) => (r.success ? this.setState({ parcelsFetched: true }) : this.fetchParcels()))
    })
  }

  render() {
    const parcels = this.getParcelsSorted().map((p: any) => <PropertyItem key={p.id} record={p} helper={new ParcelHelper(p)} teleportTo={this.props.teleportTo} />)

    return (
      <div>
        <header>
          <h3>My Parcels</h3>
        </header>
        {this.state.parcelsFetched ? <p> You own {this.state.parcels.length} parcels. </p> : <Spinner size={24} bg={'dark'} />}

        {this.state.parcels.length > 0 && (
          <div>
            <p class="sort">
              Sort by&nbsp;
              <select value={this.state.sort} onChange={(e: any) => this.setState({ sort: e.target.value })}>
                <option value="id">Parcel ID</option>
                <option value="footprint">Footprint</option>
                <option value="island">Island</option>
                <option value="suburb">Neighborhood</option>
                <option value="height">Height</option>
              </select>
            </p>

            <table>
              <tbody>{parcels}</tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
}
