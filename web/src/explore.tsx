import { Component, Fragment } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { currentVersion } from '../../common/version'
import { Event } from '../../common/messages/event'
import Head from './components/head'
import PopularParcels from './components/popular-parcels'
import { Womp } from './components/womp-card'
import { getClientPath } from './helpers/client-helpers'
import { app, AppEvent } from './state'
import WompsList from './womps-list'

type Props = {
  womps?: Womp[]
}

type RESummary = {
  id: number
  name: string
  parcels: {
    id: number
    address: string
    owner: string
  }[]
}

function FreshlyMinted() {
  const [summary, setSummary] = useState<RESummary[]>([])

  async function load() {
    const res = await fetch('/api/real-estate/summary')
    const data = await res.json()
    // console.log(data)
    setSummary(data.summary)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <h2>Freshly Minted</h2>
      <ul class="real-estate">
        {summary.map((s) => (
          <li key={s.id}>
            <a href={`/island/${s.id}`}>{s.name}</a>

            <ul>
              {s.parcels.map((p) => (
                <li key={p.id} class={`owner-${(p.owner && typeof p.owner === 'object' ? (p.owner as any).owner : (p.owner ?? '')).toLowerCase()}`}>
                  <a href={`/parcels/${p.id}`}>{p.address.slice(0, 2).trim()}</a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
function countdown(ms: number) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s`
}

function EventsList() {
  const [events, setEvents] = useState<Event[]>([])
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    fetch('/api/events.json')
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
  }, [])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const cutoff = now - 24 * 60 * 60 * 1000
  const visible = events.filter((e) => new Date(e.expires_at).getTime() >= cutoff)
  return (
    <table class="events">
      <tbody>
        {visible.slice(0, 5).map((e) => {
          const startsIn = new Date(e.starts_at).getTime() - now
          const live = startsIn <= 0 && new Date(e.expires_at).getTime() > now
          return (
            <tr key={e.id}>
              <td>
                <a href={`/events/${e.id}`}>{e.name.length > 18 ? e.name.slice(0, 17) + '...' : e.name}</a>
              </td>
              <td>{startsIn > 0 ? countdown(startsIn) : live ? 'live' : 'ended'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default class Explore extends Component<any, Props> {
  componentDidMount() {
    app.on(AppEvent.Logout, this.rerender)
    app.on(AppEvent.Login, this.rerender)
  }

  rerender = () => {
    this.forceUpdate()
  }

  componentWillUnmount() {
    app.off(AppEvent.Login, this.rerender)
    app.off(AppEvent.Logout, this.rerender)
  }

  render() {
    return (
      <section class="columns">
        <Head title="" url={'/'}>
          <Fragment>
            <link rel="prefetch" href={getClientPath(currentVersion)} />
            <link rel="prefetch" href="/api/parcels/cached.json" />
            <link rel="prefetch" href="/api/parcels/map.json" />
          </Fragment>
        </Head>

        <article>
          <h3>Live</h3>
          <p>No one is live right now</p>

          <h3>Womps</h3>
          <WompsList numberToShow={20} collapsed={false} fetch="/womps.json" womps={this.props.womps ?? undefined} ttl={600} />
        </article>

        <aside>
          <h3>Events</h3>
          <EventsList />

          <p>
            <a class="buttonish" href="/events/new">
              New Event
            </a>
          </p>

          <h3>Popular</h3>
          <PopularParcels />
        </aside>
      </section>
    )
  }
}
