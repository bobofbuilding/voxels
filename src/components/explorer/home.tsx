import { Component } from 'preact'
import EventCalendar from '../../../web/src/components/event-calendar'
import { Scene } from '../../scene'

interface Props {
  onTeleport?: () => void
  scene: Scene
}

export class Home extends Component<Props> {
  teleportTo(coords: string) {
    window.persona.teleport(coords)
    if (this.props.onTeleport) {
      this.props.onTeleport()
    }
  }

  render() {
    return (
      <div>
        <h3>Events</h3>
        <EventCalendar numEvents={4} onTeleport={this.props.onTeleport} inOverlay={true} summary={true} />
      </div>
    )
  }
}
