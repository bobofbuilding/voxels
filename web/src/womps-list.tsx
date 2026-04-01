import { Component } from 'preact'
import { Womp, WompCard } from './components/womp-card'
import cachedFetch from './helpers/cached-fetch'
import { Spinner } from './spinner'
import { wompCache } from './store/index'
import { fetchOptions } from './utils'

interface Props {
  parcels?: any
  path?: string
  numberToShow?: number
  fetch?: string
  className?: string
  collapsed?: boolean
  ttl?: number
  hint?: string
  smaller?: boolean
  womps?: Womp[]
}

interface State {
  womps?: Array<Womp>
  numberToShow: number
  activeParcels?: Map<number, number>
  fetch?: string
  loaded?: boolean
  collapsed?: boolean
}

const getFetchURL = (props: Props): string => '/api' + (props.fetch ? props.fetch : '/womps.json')

export default class WompsList extends Component<Props, State> {
  constructor(props: Props) {
    super()

    this.state = {
      womps: props.womps ?? [],
      loaded: false,
      fetch: getFetchURL(props),
      numberToShow: props.numberToShow ? props.numberToShow : 20,
      collapsed: props.collapsed ?? true,
    }
  }

  content(womp: Womp) {
    return womp.content.length <= 80 ? womp.content : womp.content.substring(0, 76) + '...'
  }

  componentDidMount() {
    this.fetch()
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.fetch !== this.props.fetch) {
      this.setState({ womps: [], loaded: false, numberToShow: this.props.numberToShow })
    }

    if (prevProps.numberToShow !== this.props.numberToShow) {
      this.setState({ numberToShow: this.props.numberToShow }, this.fetch.bind(this))
    } else if (prevProps.fetch !== this.props.fetch) {
      this.setState({ fetch: getFetchURL(this.props) }, this.fetch.bind(this))
    }
  }

  fetch() {
    const url = this.state.fetch + '?limit=' + this.state.numberToShow
    cachedFetch(url, fetchOptions(), this.props.ttl)
      .then((r) => r.json())
      .then((r) => {
        const womps = r.success ? r.womps : []
        this.setState({ womps: womps, loaded: true }, () => {
          womps.forEach((w: Womp) => wompCache.put(`/womps/${w.id}`, w))
        })
      })
  }

  showMore() {
    this.setState({ numberToShow: this.state.numberToShow + 20 }, this.fetch.bind(this))
  }

  render() {
    if (!this.state.loaded && !this.props.womps) {
      return <Spinner size={24} />
    }

    const womps = this.state.womps!.map((womp) => {
      // if parcel_id is undefined, it's likely a space; which has 0 count by default for now.
      const nearbyCount = womp.parcel_id ? this.state.activeParcels?.get(womp.parcel_id) : 0
      return <WompCard key={womp.id} nearbyCount={nearbyCount} openInSameWindow={true} className={`${this.state.collapsed ? '' : '-medium'} `} womp={womp} hoverText={`Click to teleport to ${womp.coords}`} />
    })

    const showMore = womps.length >= this.state.numberToShow

    if (!womps.length) {
      if (this.props.hint) {
        return <p>{this.props.hint}</p>
      } else {
        return null
      }
    } else {
      return (
        <div>
          <div class="wrap-grid">{womps}</div>
          <div>{showMore && <button onClick={() => this.showMore()}>Show More</button>}</div>
        </div>
      )
    }
  }
}
