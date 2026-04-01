import { Component } from 'preact'
import { addTimeToDate, diffToDuration, durationToInterval, durationToMilliSeconds, formatToDatetime, getTimezone, isInFuture, isInPast } from '../../../common/helpers/time-helpers'
import { Event, EventCategories, EventCategory } from '../../../common/messages/event'
import { SingleParcelRecord } from '../../../common/messages/parcel'
import Panel from '../components/panel'
import { removeEvent } from '../helpers/event'
import { Spinner } from '../spinner'
import { fetchAPI, fetchOptions } from '../utils'

type Props = {
  parcel: Pick<SingleParcelRecord, 'id'> // only the id is needed
  onClose?: () => void
  onUpdate?: (eventID: number) => void
  onCreate?: (eventID: number) => void
  onDelete?: () => void
}

type State = {
  id?: number
  category?: EventCategory
  name: string
  description: string
  starts_at: string
  expires_at: string
  color: string
  timezone?: string

  original_starts_at?: string
  startNow: boolean
  duration: string
  isLoading: boolean
  isSaving: boolean
  error?: string
  message?: string
}

const emptyState = (): State => ({
  id: undefined,
  category: undefined,
  name: '',
  description: '',
  starts_at: '',
  expires_at: '',
  color: '#ffffff',
  timezone: undefined,

  original_starts_at: undefined,
  duration: '00:30:00',
  startNow: false,
  error: undefined,
  isSaving: false,
  isLoading: false,
})

export class CreateEvent extends Component<Props, State> {
  static currentElement: Element | null = null
  _saveController?: AbortController

  constructor() {
    super()
    this.state = emptyState()
  }

  get formBody() {
    const t: {
      parcel_id: number
      category: EventCategory
      name: string
      description: string
      color: string
      timezone: string
      starts_at: Date
      expires_at: Date
      id?: number
    } = {
      parcel_id: this.props.parcel.id,
      category: this.state.category ?? 'session',
      name: this.state.name,
      description: this.state.description,
      color: this.state.color,
      timezone: getTimezone(new Date(this.state.starts_at || '')).toString(),
      starts_at: new Date(this.state.starts_at),
      expires_at: new Date(this.state.expires_at),
    }
    if (this.state.id) t.id = this.state.id
    return JSON.stringify(t)
  }

  private get saveCtrl() {
    this._saveController?.abort('ABORT:aborting previous save request')
    this._saveController = new AbortController()
    return this._saveController
  }

  private get eventHasStarted() {
    return this.state.original_starts_at ? !isInFuture(new Date(this.state.original_starts_at)) : false
  }

  componentDidMount() {
    this.fetchEvent().catch(console.error)
  }

  componentWillUnmount() {
    this.setState(emptyState())
  }

  setCategory(category: string) {
    let c: EventCategory | undefined
    if (category === 'exhibition' || category === 'session') {
      c = category
    }
    this.setState({ category: c })
    if (c === 'session') {
      this.setDuration('0', 'd')
    }
  }

  setDuration(input: string, frequency: string) {
    let value = parseInt(input)
    if (value < 0) {
      value = 0
    }
    const { days, hours, minutes } = durationToInterval(this.state.duration)

    let newDuration = ''
    switch (frequency) {
      case 'days':
      case 'd':
        newDuration = `${value}:${hours}:${minutes}:00`
        break
      case 'hours':
      case 'h':
        newDuration = `${days}:${value}:${minutes}:00`
        break
      case 'minutes':
      case 'm':
        newDuration = `${days}:${hours}:${value}:00`
        break
    }

    this.setState({ duration: newDuration, expires_at: addTimeToDate(this.state.starts_at, durationToMilliSeconds(newDuration)) })
  }

  async validateAndSubmit() {
    this.setState({ error: undefined, message: undefined })
    if (!this.state.category?.trim()) {
      return this.setState({ error: 'An event category must be chosen' })
    }
    if (!this.state.name?.trim()) {
      return this.setState({ error: 'Name cannot be empty' })
    }

    if (!this.state.description.trim()) {
      return this.setState({ error: 'Description cannot be empty' })
    }

    if (this.state.startNow) {
      const now = new Date()
      // round to next full minute
      // now.setSeconds(now.getSeconds() + 60)
      // now.setSeconds(0, 0)
      await this.setStateAsync({ starts_at: now.toISOString(), startNow: false })
    }

    if (!this.state.starts_at) {
      return this.setState({ error: 'Please choose a starting time' })
    }

    if (new Date(this.state.starts_at) < new Date()) {
      this.setState({ error: 'Starting time cannot be in the past' })
    }

    if (!this.state.duration) {
      return this.setState({ error: 'The duration of the event is not set' })
    }

    if (!this.state.color?.trim()) {
      return this.setState({ error: 'The color is invalid' })
    }

    await this.setExpireAt(this.state.duration)

    if (!this.state.expires_at) {
      return this.setState({ error: 'Invalid expiration' })
    }

    if (this.state.expires_at <= this.state.starts_at) {
      return this.setState({ error: "Events ends before it's starting" })
    }

    return this.state.id ? this.updateEvent() : this.addEvent()
  }

  async setExpireAt(duration: string) {
    await this.setStateAsync({ expires_at: addTimeToDate(this.state.starts_at, durationToMilliSeconds(duration)) })
  }

  render() {
    const disabled = this.eventHasStarted || this.state.isLoading || this.state.isSaving

    let header: string
    if (this.state.id) {
      header = 'Edit event'
    } else if (this.state.isLoading) {
      header = 'Loading'
    } else {
      header = 'Create an event'
    }
    return (
      <form>
        {this.state.isLoading && <Spinner size={25} bg="dark" />}
        <h3>Create Event</h3>

        {this.state.id && (
          <p>
            The URL for your event is <a href={`${process.env.ASSET_PATH}/events/${this.state.id}`}>{`${process.env.ASSET_PATH}/events/${this.state.id}`}</a>
          </p>
        )}
        {!!this.state.error && <Panel type="danger">{this.state.error}</Panel>}
        {!!this.state.message && <Panel type="info">{this.state.message}</Panel>}
        {this.eventHasStarted && <Panel type="help">This event has started and is now non-editable. However you can still delete it.</Panel>}

        <div class="f">
          <label for="category">Category</label>
          <select id="category" name="category" disabled={disabled} onChange={(e) => this.setCategory(e.currentTarget['value'])}>
            <option value="">Choose a category</option>
            {EventCategories.map((t) => {
              return (
                <option key={t} selected={t === this.state.category} value={t}>
                  {t}
                </option>
              )
            })}
          </select>
        </div>

        <div class="f">
          <label for="name">Name</label>
          <input id="name" size={64} type="text" disabled={disabled} onChange={(e) => this.setState({ name: e.currentTarget['value'] })} placeholder="Event name" required value={this.state.name} />
        </div>

        <div class="f">
          <label for="description">Description</label>
          <textarea id="description" value={this.state.description ?? ''} disabled={disabled} onChange={(e) => this.setState({ description: e.currentTarget['value'] })} placeholder="Event description" cols={9} rows={9} />
        </div>

        <div class="f">
          <label for="meeting-time">Starting</label>
          <input
            type="datetime-local"
            id="meeting-time"
            name="meeting-time"
            value={this.state.starts_at ? formatToDatetime(new Date(this.state.starts_at)) : formatToDatetime(Date.now())}
            min={formatToDatetime(Date.now())}
            onChange={(e) => this.setState({ starts_at: e.currentTarget['value'] })}
            disabled={this.state.startNow || disabled}
          />
        </div>

        <div class="f">
          <label for="starts-now">
            <input id="starts-now" checked={this.state.startNow} type="checkbox" title="Start now" disabled={disabled} onChange={(e) => this.setState({ startNow: e.currentTarget['checked'] })} />
            Starts now
          </label>
        </div>

        {this.state.category === 'exhibition' && <DayDuration disabled={disabled || !this.state.category} duration={this.state.duration} setDuration={this.setDuration.bind(this)} />}
        {this.state.category !== 'exhibition' && <HourMinDuration disabled={disabled || !this.state.category} duration={this.state.duration} setDuration={this.setDuration.bind(this)} />}

        <div class="f">
          <label for="color">Color</label>
          <input id="color" type="color" disabled={disabled} onChange={(e) => this.setState({ color: e.currentTarget['value'] })} value={this.state.color ?? this.state.color} />
        </div>

        <div class="f">
          {!this.eventHasStarted && (
            <button disabled={this.state.isSaving || this.state.isLoading} onClick={() => this.validateAndSubmit()}>
              {this.state.id ? 'Save' : 'Create'}
            </button>
          )}
          {this.state.id && (
            <button disabled={this.state.isSaving || this.state.isLoading} onClick={() => this.delete()}>
              Delete
            </button>
          )}
          {this.state.isSaving && <Spinner size={18} bg="dark" />}
        </div>
      </form>
    )
  }

  private setStateAsync(state: Partial<State>): Promise<void> {
    return new Promise((resolve) => this.setState(state, resolve))
  }

  private fetchEvent() {
    const url = `/api/parcels/${this.props.parcel.id}/event.json?cb=${Date.now()}`

    this.setState({ isLoading: true })
    return fetch(url)
      .then((r) => {
        // the server will respond with 400 success: false if there is no parcel event.
        if (!(r.ok || [400, 404].includes(r.status))) {
          throw new Error(`server responded with ${r.status} | ${r.statusText}`)
        }
        return r.json()
      })
      .then((r: { event?: Event }) => {
        // go into 'create new' mode if there is no event scheduled or the only event found is an old one
        if (!r.event || isInPast(new Date(r.event.expires_at))) {
          return
        }
        // update mode
        this.setState({
          id: r.event.id,
          category: r.event.category,
          name: r.event.name,
          description: r.event.description,
          starts_at: r.event.starts_at,
          original_starts_at: r.event.starts_at,
          expires_at: r.event.expires_at,
          color: r.event?.color,
          timezone: r.event?.timezone,
          duration: diffToDuration(new Date(r.event.starts_at), new Date(r.event.expires_at)),
        })
      })
      .catch((err) => this.setState({ error: `Failed fetching from server, ${err.message}` }))
      .finally(() => this.setState({ isLoading: false }))
  }

  private async addEvent() {
    return this.save(`/api/events/add`)
      .then(() => {
        this.setState({ message: 'Event created' })
        this.props.onCreate?.(this.state.id || 0)
      })
      .catch((err) => {
        console.error(err)
        this.setState({ error: `Failed to create event, ${err.message}` })
      })
  }

  private updateEvent() {
    return this.save('/api/events/update')
      .then(() => {
        this.setState({ message: 'Event updated' })
        this.props.onUpdate?.(this.state.id || 0)
      })
      .catch((err) => {
        console.error(err)
        this.setState({ error: `Failed to update event, ${err.message}` })
      })
  }

  private save(url: string) {
    this.setState({ error: undefined, isSaving: true })
    return fetchAPI(url, fetchOptions(this.saveCtrl, this.formBody))
      .then(this.fetchEvent.bind(this))
      .finally(() => this.setState({ isSaving: false }))
  }

  private delete() {
    if (!this.state.id) {
      return this.setState({ error: "can't delete id-less event" })
    }
    this.setState({ isSaving: true, message: undefined, error: undefined })
    removeEvent(this.state.id, (success) => {
      if (!success) {
        return this.setState({ error: 'failed to delete event' })
      }
      this.setState(emptyState())
      this.props.onDelete?.()
      this.props.onClose?.()
    })
  }
}

type DurationProps = {
  disabled: boolean
  duration: string
  setDuration: (input: string, frequency: string) => void
}

const validateDuration = (keyEvent: globalThis.Event) => {
  const e = keyEvent.target as HTMLInputElement | null
  if (!e) return
  // Always 2 digits
  if (e.value.length >= 2) e.value = e.value.slice(0, 2)
  // 0 on the left (doesn't work on FF)
  if (e.value.length === 1) e.value = '0' + e.value
  // Avoiding letters on FF
  if (!e.value) e.value = '00'
}

function DayDuration(props: DurationProps) {
  const { days, hours, minutes } = durationToInterval(props.duration)
  return (
    <div>
      <label for="duration">Duration (days:hours:minutes)</label>
      <div>
        <input id="duration-days" disabled={props.disabled} type="number" value={days} min="0" max="14" placeholder="0" size={5} onInput={validateDuration} onChange={(e) => props.setDuration(e.currentTarget['value'], 'd')} />
        :
        <input id="duration-hours" disabled={props.disabled} type="number" value={hours} min="0" max="23" placeholder="23" size={5} onInput={validateDuration} onChange={(e) => props.setDuration(e.currentTarget['value'], 'h')} />
        :
        <input id="duration-minutes" disabled={props.disabled} type="number" value={minutes} min="0" max="59" placeholder="00" size={5} onInput={validateDuration} onChange={(e) => props.setDuration(e.currentTarget['value'], 'm')} />
      </div>
    </div>
  )
}

function HourMinDuration(props: DurationProps) {
  const { hours, minutes } = durationToInterval(props.duration)
  return (
    <div>
      <label for="duration">Duration (hours:minutes)</label>
      <div>
        <input id="duration-hours" disabled={props.disabled} type="number" value={hours} min="0" max="23" placeholder="23" size={5} onInput={validateDuration} onChange={(e) => props.setDuration(e.currentTarget['value'], 'h')} />
        :
        <input id="duration-minutes" disabled={props.disabled} type="number" value={minutes} min="0" max="59" placeholder="00" size={5} onInput={validateDuration} onChange={(e) => props.setDuration(e.currentTarget['value'], 'm')} />
      </div>
    </div>
  )
}

export function toggleEventManagerWindow(parcel: Pick<SingleParcelRecord, 'id'>, onCreate?: (id: number) => void, onUpdate?: (id: number) => void, onDelete?: () => void, onClose?: () => void) {
  // if (EventManagerWindow.currentElement) {
  //   unmountComponentAtNode(EventManagerWindow.currentElement) // unmount the component
  //   EventManagerWindow.currentElement = null
  // } else {
  //   const div = document.createElement('div')
  //   document.body.appendChild(div)
  //   EventManagerWindow.currentElement = div
  //   render(
  //     <EventManagerWindow
  //       parcel={parcel}
  //       onUpdate={onUpdate}
  //       onCreate={onCreate}
  //       onDelete={onDelete}
  //       onClose={() => {
  //         !!EventManagerWindow.currentElement && unmountComponentAtNode(EventManagerWindow.currentElement) // unmount the component
  //         EventManagerWindow.currentElement = null
  //         onClose?.()
  //         div?.remove()
  //       }}
  //     />,
  //     div,
  //   )
  // }
}
