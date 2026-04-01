import { sortBy } from 'lodash'
import ParcelHelper from '../../../../../common/helpers/parcel-helper'
import { app } from '../../../state'
import { fetchOptions } from '../../../utils'
import PropertyItem from '../../property-item'
import ParcelList from './parcel-list'

export default class AllContributingParcels extends ParcelList {
  /**
   * fetch parcels using a different api given the type of ownership.
   */
  fetchParcels = () => {
    this.fetchContributingParcels()
  }

  fetchContributingParcels() {
    this.setState({ parcelsFetched: false })
    fetch(`${process.env.API}/wallet/${app.state.wallet}/contributing-parcels.json${this.shouldCacheBust()}`, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        const parcels = r.parcels || []
        this.setState({ parcels, parcelsFetched: true })
      })
  }

  getContributorsParcelsSorted() {
    const result = sortBy(this.state.parcels, (p: any) => {
      const h = new ParcelHelper(p)

      switch (this.state.sort) {
        case 'id':
          return parseInt(p.id, 10)
        case 'footprint':
          return Math.abs((h.x2 - h.x1) * (h.z2 - h.z1))
        case 'owner':
          return h.ownerName
        case 'suburb':
          return p.suburb
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
    const contributorsParcels = this.getContributorsParcelsSorted().map((p: any) => <PropertyItem key={p.id} record={p} helper={new ParcelHelper(p)} teleportTo={this.props.teleportTo} />)

    return (
      <div>
        <header>
          <h3>Collaborations</h3>
        </header>

        {this.state.parcels.length > 0 ? (
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
              <tbody>{contributorsParcels}</tbody>
            </table>
          </div>
        ) : (
          <p />
        )}
      </div>
    )
  }
}
