import { Component, render } from 'preact'
import { fetchOptions } from '../utils'
import { parcelCache } from '../store/index'
import { Spinner } from '../spinner'
import cachedFetch from '../helpers/cached-fetch'

export interface Props {}

export interface State {
  traffics: Traffic[]
  fetching: boolean
}

type Traffic = {
  id: number
  visits: number
  day: number
  parcel: {
    id: number
    name: string
    address: string
    description?: string
  }
}

export default class PopularParcels extends Component<Props, State> {
  constructor(props: any) {
    super(props)
    this.state = {
      fetching: true,
      traffics: [],
    }
  }

  componentDidMount() {
    this.fetch()
  }

  async fetch() {
    this.setState({ fetching: true })

    const r = await cachedFetch(`/api/popular/parcels`)
    const data = await r.json()

    console.log(data)

    if (!data.success) {
      return
    }

    const { traffics } = data

    this.setState({ traffics, fetching: false })

    this.populateCache()
  }

  populateCache() {
    //   this.state.parcels.forEach((p: any) => {
    //     parcelCache.put(`/parcels/${p.id}`, p)
    //   })
  }

  render() {
    const popular = this.state.traffics.slice(0, 20).map((t: Traffic) => {
      return (
        <>
          <dt>{t.visits} Visits</dt>
          <dd>
            <a href={`/parcels/${t.parcel.id}`}>{t.parcel.name || t.parcel.address}</a>
          </dd>
        </>
      )
    })

    return <div>{this.state.fetching ? <Spinner /> : <dl>{popular}</dl>}</div>
  }
}
