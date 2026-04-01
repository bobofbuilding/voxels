import { groupBy } from 'lodash'
import { Component } from 'preact'
import { dayOfWeek } from '../../../../common/helpers/time-helpers'
import Graph, { chartType } from './chart-builder'
import { ParcelEventResult } from '../../../../common/helpers/apis'

export interface Props {
  className?: string
  parcel: any
  daysToFetch?: number
}

export interface State {
  parcel: any
  loading: boolean
  event: 'playerenter' | 'click' | 'playerleave'
  events?: ParcelEventResult[]
}

export type ParcelEventSummed = {
  eventsByHour: Record<string, ParcelEventResult>
}

const parseDateToYYYMMDDHour = (date: Date) => {
  return date.toISOString().split(':')[0] + ':00'
}
export default class ParcelEventsCharts extends Component<Props, State> {
  constructor(props: any) {
    super(props)
    this.state = {
      loading: true,
      events: [],
      event: 'playerenter',
      parcel: props.parcel,
    }
  }

  get parcel() {
    return !!this.state.parcel && this.state.parcel
  }

  get parcelEvents() {
    if (!this.state.events) {
      return null
    }
    const d = this.summarized(this.state.events)
    const names = Object.keys(d)
      .map((s) => this.formatShortDate(s))
      .reverse()
    const values = Object.values(d)
      .map((v) => v.length)
      .reverse()
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
    this.fetch()
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (prevProps.parcel.id != this.props.parcel.id) {
      this.setState({ parcel: this.props.parcel })
      this.fetch()
    }
    if (prevState.event != this.state.event) {
      this.fetch()
    }
  }

  async fetch() {
    this.setState({ loading: true })
    const SURVEYOR_URL = 'https://surveyor.crvox.com'
    await fetch(`${SURVEYOR_URL}/api/events/by/parcel/${this.parcel.id}.json?event=${this.state.event}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          const events = r.events as ParcelEventResult[]
          this.setState({ events })
        }
      })
    this.setState({ loading: false })
  }

  formatShortDate(dt: string) {
    const date = new Date(dt)
    return date.getMonth() + 1 + '-' + dayOfWeek(date, true) + '-' + date.getDate() + ' @ ' + date.getHours() + 'h'
  }

  summarized(events: ParcelEventResult[]) {
    return groupBy(events, (p) => parseDateToYYYMMDDHour(new Date(p.time)))
  }

  render() {
    return (
      <div>
        <h3>Recent Parcel interactions</h3>
        <p>
          <small>One bar represents number of interactions in an hour.</small>
        </p>
        <select value={this.state.event} onChange={(e) => this.setState({ event: e.currentTarget.value as any })}>
          <option value="playerenter">'playerenter' event</option>
          <option value="playerleave">'playerleave' event</option>
          <option value="click">'click' events</option>
        </select>

        <div className={this.props.className ? this.props.className : ''}>
          {!this.state.loading ? (
            <Graph
              type={chartType.Bar}
              data={this.parcelEvents!}
              name={`events-${this.parcel.id}`}
              options={{
                title: null!,
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
