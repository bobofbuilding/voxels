import { Component } from 'preact'
import { app } from '../../state'
import { isInWorld } from '../../../../common/helpers/detector'
import MailboxUI from './mailbox-ui'

export interface Props {
  wallet: string
  className?: string
}

export interface State {
  wallet: string | null
  mailsCount?: number
  tab: string | null
  addressTo: string | null
}

export default class Mailbox extends Component<Props, State> {
  element: HTMLElement = undefined!
  interval: number = undefined!

  constructor(props: Props) {
    super(props)

    this.state = {
      wallet: props.wallet,
      mailsCount: app.state.unreadMailCount,
      tab: null,
      addressTo: null,
    }
  }

  get count() {
    return this.state.mailsCount || 0
  }

  get isQuiet() {
    return app.state.settings && !!app.state.settings.quietMails
  }

  setRef = (dom: any) => (this.element = dom)

  componentDidMount() {
    if (!this.state.wallet) {
      return
    }
  }

  componentWillUnmount() {
    this.interval && clearInterval(this.interval)
  }

  markAsRead(id: number) {
    app.markMailAsRead(id)
  }

  shouldComponentUpdate() {
    return !MailboxUI.active
  }

  render() {
    if (!this.state.wallet) {
      return null
    }
    return (
      <div key="a" className={`PopupAction mailbox-icon ${this.props.className && this.props.className} ${isInWorld() ? ' -inWorld' : ''}`} ref={this.setRef}>
        {this.count > 0 && !this.isQuiet && <div></div>}
        <a href={`/mailbox`}>Inbox</a>
      </div>
    )
  }
}
