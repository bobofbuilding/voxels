import { Component } from 'preact'
import EventsShowcase from './components/events-showcase'
import Head from './components/head'

export interface Props {
  spaces?: Array<any>
  path?: string
}

export interface State {
  spaces?: Array<any>
}

export default class Events extends Component<Props, State> {
  render() {
    return (
      <section>
        <Head title="Events" url="/events" description="See what running and upcoming events are happening in voxels" />
        <hgroup>
          <h1>Events</h1>
          <p>See what running and upcoming events are happening in voxels</p>
        </hgroup>

        <EventsShowcase />
      </section>
    )
  }
}
