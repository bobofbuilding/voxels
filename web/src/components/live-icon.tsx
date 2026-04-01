import { Component } from 'preact'

interface liveIconProps {
  className?: string
}

export default class LiveIcon extends Component<liveIconProps, any> {
  render() {
    return (
      <div title="This event is live!" className={`LiveIndicator ${this.props.className ?? ''}`}>
        <div>
          <div>Event is live!</div>
        </div>
      </div>
    )
  }
}
