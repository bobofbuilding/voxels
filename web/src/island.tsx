import { Component } from 'preact'
import Head from './components/head'
import Loading from './components/loading'
import { fetchOptions } from './utils'

const L = null

export interface Props {
  slug?: number
  path?: string
}

export interface State {
  island?: any
  slug?: any
  parcels?: any
}

export default class Parcels extends Component<Props, State> {
  map: L.Map | null = null

  constructor() {
    super()
  }

  get L() {
    return window.L
  }

  get latlng() {
    return {
      lat: this.state.island.position.coordinates[1],
      lng: this.state.island.position.coordinates[0],
    }
  }

  get coords() {
    let [lng, lat] = this.state.island.position.coordinates

    lat = Math.floor(Math.abs(lat * 100)) + ' metres ' + (lat < 0 ? 'south' : 'north')
    lng = Math.floor(Math.abs(lng * 100)) + ' metres ' + (lng < 0 ? 'west' : 'east')

    return `Located ${lat}, ${lng} of center.`
  }

  async waitForDomAndLeaflet() {
    // Wait for the Dom to be loaded and for Leaflet to be ready before loading the map.
    return new Promise((resolve) => {
      const i = setInterval(() => {
        if (window.L && document.querySelector('#map')) {
          clearInterval(i)
          resolve(true)
        }
      }, 100)
    })
  }

  componentDidMount() {
    this.fetch()

    fetch(`${process.env.API}/parcels.json`, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        const parcels = r.parcels
        this.setState({ parcels })
        setTimeout(() => this.addParcels(), 50)
      })
  }

  componentDidUpdate() {
    if (this.props.slug !== this.state.slug) {
      this.fetch()
    }
  }

  fetch() {
    const slug = this.props.slug

    this.setState({ slug })

    fetch(`${process.env.API}/islands/${slug}.json`, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        this.setState({ island: r.island })

        if (this.map) {
          this.map.setView(this.latlng, 9)
        }
      })
  }

  addParcels() {
    if (!this.map) {
      return
    }

    const onEachFeature = (feature: any, layer: any) => {
      layer.on('click', () => {
        const p = feature.parcels.parcel
        const div = document.createElement('div')
        div.innerHTML = `<b><a href='/parcels/${p.id}'>${p.address}</a></b><br /><br />${p.price ? p.price.toFixed(2) + '<small>ETH</small>' : ''}`

        layer.bindPopup(div).openPopup()
      })
    }

    const other = {
      color: '#333333',
      opacity: 0,
      fillColor: '#ffffff',
      fillOpacity: 0,
      dashArray: '5,5',
      weight: 4,
    }

    this.L.geoJSON(
      this.state.parcels.map((p: any) => {
        return { type: 'Feature', geometry: p.geometry, parcels: { parcel: p } }
      }),
      { style: other, onEachFeature },
    ).addTo(this.map)
  }

  async addMap() {
    if (this.map) {
      return
    }
    await this.waitForDomAndLeaflet()
    const mapElement: HTMLElement | null = document.querySelector('#map')
    if (!mapElement) {
      console.error('Map element not found')
      return
    }
    this.map = this.L.map(mapElement, { scrollWheelZoom: false }).setView(this.latlng, 9)

    this.L.tileLayer(`${process.env.MAP_URL}/tile/?z={z}&x={x}&y={y}`, {
      minZoom: 5,
      maxZoom: 20,
      attribution: 'Map data &copy; Voxels',
      id: 'cryptovoxels',
    }).addTo(this.map)
  }

  render() {
    if (!this.state.island) {
      return <Loading />
    }

    const parcels = this.state.island.parcels.map((p: any) => {
      return (
        <li>
          <a className={p.name ? 'bold' : ''} href={`/parcels/${p.id}`}>
            {p.name || p.address}
          </a>
        </li>
      )
    })

    if (!this.map && window && window['addEventListener']) {
      setTimeout(() => this.addMap(), 50)
    }

    const height = window.innerHeight - 80 + 'px'

    return (
      <section>
        <Head title={`${this.state.island.name}`} />

        <h1>{this.state.island.name}</h1>
        <p>{this.coords}</p>
        <div id="map" class={'map map-web'} style={{ height }}></div>

        <div>
          <h3>Places</h3>

          <ul>{parcels}</ul>
        </div>
      </section>
    )
  }
}
