import { useEffect, useState } from 'preact/hooks'
import { Event } from '../../../common/messages/event'
import { truncate } from '../lib/string-utils'
import { fetchAPI, fetchOptions } from '../utils'
type Props = {}

function TimeCard({ date }: { date: Date }) {
  const day = date.toLocaleDateString('en-US', { day: 'numeric' })
  const month = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).split(' ')[0]

  return (
    <div class="timecard">
      <b>{day}</b>
      <br />
      <sub>{month}</sub>
    </div>
  )
}

export function Blocks({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <>
          <div />
          <div />
        </>
      ))}
    </div>
  )
}

export default function (props: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoaded, setIsLoaded] = useState<boolean>(false)

  useEffect(() => {
    fetchAPI(`/api/events.json`, fetchOptions()).then((data) => {
      setEvents(data.events)
      setIsLoaded(true)
    })
  }, [])

  if (!isLoaded) {
    return (
      <div>
        <Blocks count={10} />
      </div>
    )
  }

  return (
    <table class="events">
      <thead>
        <tr>
          <th scope="col" style="width: 10%"></th>
          <th scope="col" style="width: 60%">
            Name
          </th>
          <th scope="col">Author</th>
          <th scope="col" style="width: 20%">
            Time, Parcel address
          </th>
        </tr>
      </thead>
      <tbody>
        {events.slice(0, 10).map((event) => {
          const time = new Date(event.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).replace(/^0/, '').toLowerCase()

          return (
            <>
              <tr>
                <td rowSpan={2} width="120">
                  <TimeCard date={new Date(event.starts_at)} />
                </td>
                <td>
                  <a href={`/events/${event.id}`}>{truncate(event.name)}</a>
                </td>
                <td>{event.author_name}</td>
                <td>
                  {time}, {event.parcel_name}
                </td>
              </tr>
              <tr>
                <td colSpan={4}>
                  <small>{truncate(event.description, 80)}</small>
                </td>
              </tr>
            </>
          )
        })}
      </tbody>
    </table>
  )
}
