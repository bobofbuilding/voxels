import { Component } from 'preact'
import { getWearableGif } from '../helpers/wearable-helpers'
import { Spinner } from '../spinner'

export interface Props {}

export interface State {
  wearables?: any
  fetching?: boolean
}

export default class MostPopularWearables extends Component<Props, State> {
  constructor(props: any) {
    super(props)
    this.state = {
      wearables: null,
      fetching: true,
    }
  }

  componentDidMount() {
    this.setState({ fetching: true })
    this.fetch()
  }

  fetch() {
    fetch(`${process.env.API}/admin/stats/wearables-worn.json?limit=10`)
      .then((r) => r.json())
      .then((r) => {
        const wearables = r.stats
        this.setState({ wearables, fetching: false })
      })
  }

  onSelect(id: any) {
    window.location.href = '/wearables/' + id
  }

  render() {
    if (!this.state.fetching) {
      const wearables = this.state.wearables.map((w: any) => {
        return (
          <li onClick={() => this.onSelect(w.id)}>
            <img src={getWearableGif(w)} />
            {w.name}
            <br />
            <small>{w.description}</small>
          </li>
        )
      })
      return (
        <div>
          <ul>{wearables}</ul>
        </div>
      )
    } else {
      return <Spinner size={16} />
    }
  }
}
