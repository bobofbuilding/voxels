import { Component } from 'preact'
import { dayOfWeek } from '../../../../common/helpers/time-helpers'
import { fetchOptions } from '../../utils'
import Graph, { chartType } from './chart-builder'

export interface Props {
  className?: string
  width?: number
  height?: number
  children?: any
  parcel: any
  daysToFetch?: number
}

export interface State {
  parcel: any
  loading: boolean
  days: number
  parcelTraffic?: any
}

export default class ParcelVisitsChart extends Component<Props, State> {
  // lol wtf, why is this a static
  static visits: Record<string, any> = {}

  constructor(props: Props) {
    super(props)
    this.state = {
      loading: true,
      days: props.daysToFetch || 7,
      parcelTraffic: null,
      parcel: props.parcel,
    }
  }

  get parcel() {
    return !!this.state.parcel && this.state.parcel
  }

  get parcelTraffic() {
    if (!this.state.parcelTraffic) {
      return null
    }
    const d = this.state.parcelTraffic
    const names = d.map((s: any) => this.formatShortDate(s.dt))
    const values = d.map((s: any) => (s.sum_visits ? s.sum_visits : 0))
    return {
      labels: names,
      datasets: [
        {
          data: values,
          backgroundColor: '#a3c6ff61',
          borderColor: '#1a73e8',
          borderWidth: 1,
        },
      ],
    }
  }

  componentDidMount() {
    this.getTraffic()
  }

  getTraffic() {
    if (ParcelVisitsChart.visits[this.parcel.id + '-' + this.state.days]) {
      this.setState({ parcelTraffic: ParcelVisitsChart.visits[this.parcel.id + '-' + this.state.days], loading: false })
      return
    }
    this.fetch()
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.parcel.id != this.props.parcel.id || prevProps.daysToFetch != this.props.daysToFetch) {
      this.setState({ parcel: this.props.parcel, days: this.props.daysToFetch })
      this.fetch()
    }
  }

  async fetch() {
    await fetch(`${process.env.API}/parcels/${this.parcel.id}/traffic.json?day=${this.state.days}`, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          const parcelTraffic = r.stats
          this.setState({
            parcelTraffic,
          })
          ParcelVisitsChart.visits[this.parcel.id + '-' + this.state.days] = parcelTraffic
        }
      })
    this.setState({ loading: false })
  }

  formatShortDate(dt: string) {
    const date = new Date(dt)
    return dayOfWeek(date, true) + '-' + date.getDate()
  }

  render() {
    return (
      <div>
        <h3>{this.props.daysToFetch} days of traffic</h3>
        <p>
          <small>One bar represents a quarter of a day.</small>
        </p>

        <div className={this.props.className ? this.props.className : ''}>
          {!this.state.loading && this.parcelTraffic ? (
            <Graph
              type={chartType.Bar}
              data={this.parcelTraffic}
              name={`traffic-${this.parcel.id}-${this.state.days}`}
              options={{
                title: undefined,
                legend: false,
              }}
            />
          ) : (
            <div></div>
          )}
        </div>
      </div>
    )
  }
}
