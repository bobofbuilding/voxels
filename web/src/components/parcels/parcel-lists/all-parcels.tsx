import ParcelHelper from '../../../../../common/helpers/parcel-helper'
import { Spinner } from '../../../spinner'
import { fetchOptions } from '../../../utils'
import PropertyItem from '../../property-item'
import ParcelList from './parcel-list'

export default class AllParcels extends ParcelList {
  static Pane: AllParcels | null
  query?: string

  constructor() {
    super()
    AllParcels.Pane = this
  }

  // called by AllParcels.Pane.searchParcel()
  searchParcel(searchQuery: string) {
    this.query = searchQuery
    this.fetchParcels(this.state.page)
  }

  componentWillUnmount() {
    AllParcels.Pane = null
  }

  /**
   * fetch parcels using a different api given the type of ownership.
   */
  fetchParcels = (page?: number) => {
    this.setState({ parcelsFetched: false }, () => {
      this.fetchAllParcels(page)
    })
  }

  fetchAllParcels(page = 0) {
    let url = `${process.env.API}/parcels/search.json?q=${encodeURIComponent(this.query ?? '')}&page=${page}&limit=50&cb=${Date.now()}`
    url += `&sort=${this.state.sort}`
    url += `&asc=${this.state.ascending}`

    this.setState({ page, parcelsFetched: false })
    fetch(url, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        const parcels = r.parcels || []
        this.setState({ parcels, parcelsFetched: true })
      })
  }

  sortAndFetch() {
    this.fetchParcels()
  }

  render() {
    const parcels = this.state.parcels.map((p: any) => <PropertyItem key={p.id} record={p} helper={new ParcelHelper(p)} teleportTo={this.props.teleportTo} />)

    if (!this.state.parcelsFetched) {
      return <Spinner size={24} bg={'dark'} />
    }

    return (
      <div>
        <div>
          {this.state.page > 0 && <button onClick={() => this.fetchParcels(this.state.page - 1)}>Previous</button>}
          <span>{'Page ' + (this.state.page + 1)}</span>
          {this.state.parcels.length > 0 && <button onClick={() => this.fetchParcels(this.state.page + 1)}>Next</button>}
        </div>

        {this.state.parcels.length > 0 && (
          <div>
            <label>
              Sort by:&nbsp;
              <select
                value={`${this.state.sort} ${this.state.ascending ? 'asc' : 'desc'}`}
                onChange={(e: any) => {
                  const [sort, dir] = e.target.value.split(' ')

                  console.log(dir)
                  console.log(this.state.ascending)

                  this.setState({ sort, ascending: dir === 'asc' }, () => {
                    this.sortAndFetch()
                  })
                }}
              >
                <option value="id asc">Parcel ID ↑</option>
                <option value="id desc">Parcel ID ↓</option>
                <option value="area asc">Area ↑</option>
                <option value="area desc">Area ↓</option>
                <option value="island asc">Island ↑</option>
                <option value="island desc">Island ↓</option>
                <option value="suburb asc">Neighborhood ↑</option>
                <option value="suburb desc">Neighborhood ↓</option>
                <option value="height asc">Height ↑</option>
                <option value="height desc">Height ↓</option>
                <option value="distance asc">Distance ↑</option>
                <option value="distance desc">Distance ↓</option>
              </select>
            </label>

            <table>
              <tbody>{parcels}</tbody>
            </table>
          </div>
        )}

        <div>
          {this.state.page > 0 && <button onClick={() => this.fetchParcels(this.state.page - 1)}>Previous</button>}
          {this.state.parcels.length > 0 && <button onClick={() => this.fetchParcels(this.state.page + 1)}>Next</button>}
        </div>
      </div>
    )
  }
}
