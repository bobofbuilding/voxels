import { Component, JSX } from 'preact'
import { format } from 'timeago.js'
import { ApiMails, MessageRecord } from '../../../../common/messages/api-mails'
import { validateMessageResponse } from '../../../../common/messages/validate'
import { app, AppEvent } from '../../state'
import { fetchOptions } from '../../utils'
import { PanelType } from '../panel'

enum Tab {
  Messages = 'messages',
  Write = 'write',
}

interface Props {
  tab?: Tab
  addressTo: string | null
  onClose?: () => void
}

interface State {
  tab: Tab
  mails: MessageRecord[]
  notificationsMuted: boolean
  loading: boolean
  unreadCount: number
  wallet: string | null
  addressTo: string | null
}

export default class MailboxUI extends Component<Props, State> {
  static active: MailboxUI

  constructor(props: Props) {
    super(props)

    if (!app.state.wallet) {
      throw new Error('MailboxUI requires a wallet')
    }

    this.state = {
      tab: props.tab || Tab.Messages,
      addressTo: props.addressTo,
      notificationsMuted: !!app.state.settings?.quietMails,
      mails: [],
      loading: true,
      wallet: app.state.wallet,
      unreadCount: app.state.unreadMailCount,
    }
  }

  onAppChange = () => {
    const { wallet, unreadMailCount } = app.state
    if (!wallet) {
      this.close()
      return
    }
    this.setState({ wallet, unreadCount: unreadMailCount })
  }

  setQuiet(value: boolean) {
    this.setState({ notificationsMuted: value })
    const settings = Object.assign({}, app.state.settings, { quietMails: value })
    app.setAvatar({ settings })
  }

  componentDidMount() {
    app.on(AppEvent.Change, this.onAppChange)
    this.fetchMails()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.wallet && prevState.wallet !== this.state.wallet) {
      this.fetchMails()
    }
  }

  componentWillUnmount() {
    app.removeListener(AppEvent.Change, this.onAppChange)
  }

  close() {
    this.props.onClose!()
  }

  fetchMails() {
    if (!this.state.wallet) {
      this.setState({ mails: [], loading: false })
      return
    }
    this.setState({ loading: true })
    let url = `${process.env.API}/mails/by/${this.state.wallet}.json`
    url += `?${Date.now()}`
    fetch(url, fetchOptions())
      .then(validateMessageResponse(ApiMails))
      .then((r) => {
        if (r.success) {
          this.setState({ mails: r.mails || [], loading: false })
        }
        this.setState({ loading: false })
      })
  }

  markAsRead = (id: number) => {
    app.markMailAsRead(id)
  }

  reply = () => {}
  render() {
    if (!this.state.wallet) {
      return <div>Must be logged in to send mail</div>
    }
    let mail = this.state.mails.map((m) => {
      return <Message key={m.id} message={m} wallet={this.state.wallet!} markAsRead={this.markAsRead} onReply={this.reply} />
    })

    if (mail.length === 0) {
      mail = [<div>{this.state.loading ? <strong>Loading...</strong> : <em>You have no messages.</em>}</div>]
    }

    return (
      <>
        <aside>{mail}</aside>
        <article>
          <Write wallet={this.state.wallet} addressTo={this.state.addressTo} />
        </article>
      </>
    )
  }
}

interface MessageProps {
  message: MessageRecord
  wallet: string
  markAsRead?: Function
  onReply?: (sender: string) => void
}

interface MessageState {
  message: MessageRecord
  collapsed: boolean
}

export class Message extends Component<MessageProps, MessageState> {
  constructor(props: MessageProps) {
    super(props)

    this.state = {
      message: props.message,
      collapsed: true,
    }
  }

  get isSender() {
    return this.state.message.sender.toLowerCase() == this.props.wallet?.toLowerCase()
  }

  componentDidUpdate(prevProps: MessageProps) {
    if (this.props != prevProps) {
      if (!this.state.collapsed) {
        this.setState({
          message: this.props.message,
          collapsed: false,
        })
      } else {
        this.setState({
          message: this.props.message,
        })
      }
    }
  }

  toggleRead() {
    const m = this.state.message
    m.read = true
    this.setState({ message: m })
    this.props.markAsRead && this.props.markAsRead(this.state.message.id)
  }

  componentDidMount() {
    if (!this.state.message) {
      return
    }
  }

  onReply(message: MessageRecord) {
    if (this.state.message.sender == 'system') {
      return
    }
    this.props.onReply && this.props.onReply(message.sender)
  }

  toggleCollapse() {
    if (this.state.collapsed && !this.state.message.read && this.state.message.destinator.toLowerCase() == this.props.wallet.toLowerCase()) {
      this.toggleRead()
    }
    this.setState({ collapsed: !this.state.collapsed })
  }

  render() {
    return (
      <div>
        <div className={`subject`} onClick={() => this.toggleCollapse()} title={this.state.message.subject}>
          <b className={this.state.message.read || this.isSender ? 'read' : undefined}>
            {this.state.collapsed ? '+ ' : '- '}
            {this.isSender && ' sent↩ '}
            {this.state.message.subject}
          </b>
          {this.state.collapsed && <small>{format(this.state.message.created_at)}</small>}
        </div>
        <div className={`content collapsible ${this.state.collapsed ? 'collapsed' : ''}`}>
          <p>{this.state.message.content || ''}</p>
          <small>
            <a onClick={() => this.onReply(this.state.message)}> By : {this.state.message.sender_name || this.state.message.sender.substr(0, 18) + '...'}</a>
          </small>
        </div>
      </div>
    )
  }
}

interface formProps {
  wallet: string
  addressTo: string | null
}

interface formState {
  subject: string
  content: string
  destinator?: string
  sending: boolean
  sent: boolean
  error: boolean
}

export class Write extends Component<formProps, formState> {
  constructor(props: formProps) {
    super(props)

    this.state = {
      subject: null!,
      content: null!,
      destinator: props.addressTo || undefined,
      sending: false,
      sent: false,
      error: false,
    }
  }

  componentDidMount() {
    if (!this.props.wallet) {
      return
    }
  }

  validate() {
    if (!this.state.content || this.state.content == '' || this.state.content == ' ') {
      app.showSnackbar("Content can't be empty", PanelType.Danger)
      return false
    }
    if (this.state.content.length > 1000) {
      app.showSnackbar('Content is too big (1000 characters max)', PanelType.Danger)
      return false
    }
    if (!this.state.destinator || this.state.destinator.length < 40) {
      app.showSnackbar("Destinator isn't a correct address", PanelType.Danger)
      return false
    }
    if (!this.state.subject || this.state.subject == '' || this.state.subject == ' ') {
      app.showSnackbar("Subject can't be empty", PanelType.Danger)
      return false
    }
    if (this.state.subject.length > 250) {
      app.showSnackbar('Content is too big (250 characters max)', PanelType.Danger)
      return false
    }
    return true
  }

  async sendMail(e: JSX.TargetedMouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (!this.validate()) {
      return
    }
    this.setState({ sending: true, error: false })
    const body = {
      destinator: this.state.destinator,
      subject: this.state.subject,
      content: this.state.content,
    }

    let p

    try {
      p = await fetch(process.env.API + `/mails/create`, {
        method: 'put',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (e) {
      this.setState({ error: true, sending: false })
      return
    }

    const r = await p.json()

    if (r.success) {
      this.setState({ sent: true })
    } else {
      this.setState({ error: true })
    }
    this.setState({ sending: false })
  }

  render() {
    return (
      <div>
        {this.state.sending && <h2>Sending...</h2>}
        {this.state.sent && <h2>Sent!</h2>}
        {this.state.error && <h2>Something went wrong, please try again.</h2>}
        <form>
          <div class="f">
            <label for="destinator">Recipient</label>
            <input type="text" name="destinator" placeholder="0xa5G1..." value={this.state.destinator || ''} onInput={(e) => this.setState({ destinator: (e as any).target['value'] })} />
          </div>
          <div class="f">
            <label for="subject">Subject</label>
            <input type="text" name="subject" maxLength={250} value={this.state.subject || ''} onInput={(e) => this.setState({ subject: (e as any).target['value'] })} />
          </div>
          <div class="f">
            <label for="content">Message</label>
            <textarea name="content" maxLength={1000} rows={10} cols={40} value={this.state.content || ''} onInput={(e) => this.setState({ content: (e as any).target['value'] })}></textarea>
          </div>
          <div class="f">
            <button onClick={(e) => !this.state.sending && this.sendMail(e)} disabled={this.state.sending}>
              Send
            </button>
          </div>
          <div class="f">
            <small>⚠️ This service should not be considered secure. Use it for your convenience only. Do not share any personal information, including passwords and seed phrases.</small>
          </div>
        </form>
      </div>
    )
  }
}

export function openMailboxUI(addressTo: string | null) {
  window.location.href = addressTo ? `/mail?to=${addressTo}` : '/mail'
  // // close the last window if we open another one
  // if (MailboxUI.active) {
  //   MailboxUI.active.close()
  // }

  // return new Promise((resolve) => {
  //   const div = document.createElement('div')
  //   div.className = 'pointer-lock-close'
  //   document.body.appendChild(div)

  //   const tab = addressTo ? Tab.Write : Tab.Messages

  //   render(
  //     <MailboxUI
  //       onClose={() => {
  //         if (!div.parentElement) return
  //         MailboxUI.active = null!
  //         div && unmountComponentAtNode(div)
  //         div.remove()
  //       }}
  //       addressTo={addressTo}
  //       tab={tab}
  //       ref={(instance) => {
  //         MailboxUI.active = instance
  //         resolve(instance)
  //       }}
  //     />,
  //     div,
  //   )

  //   exitPointerLock()
  // })
}
