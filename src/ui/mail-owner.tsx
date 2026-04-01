import { Component, render } from 'preact'
import { unmountComponentAtNode } from 'preact/compat'
import { PanelType } from '../../web/src/components/panel'
import { app } from '../../web/src/state'
import Connector from '../connector'
import { exitPointerLock, requestPointerLock } from '../../common/helpers/ui-helpers'
import type Parcel from '../parcel'

interface Props {
  parcel?: Parcel
  onClose?: () => void
}

export class MailOwner extends Component<Props, any> {
  constructor() {
    super()

    this.state = {
      content: null,
      sending: false,
      sent: false,
      error: false,
    }
  }

  get connector() {
    return window.connector as Connector
  }

  get user() {
    return this.connector.persona && this.connector.persona.user
  }

  validate() {
    if (!this.state.content || this.state.content == '' || this.state.content == ' ') {
      app.showSnackbar("Content can't be empty", PanelType.Danger)
      return false
    }
    if (!this.props.parcel!.owner || this.props.parcel!.owner.length < 40) {
      app.showSnackbar("Destinator isn't a correct address", PanelType.Danger)
      return false
    }
    if (!this.user) {
      app.showSnackbar('You have to be logged in', PanelType.Danger)
      return false
    }
    return true
  }

  sendMail() {
    if (!this.validate()) {
      return
    }
    this.setState({ sending: true, error: false })
    const body = {
      destinator: this.props.parcel!.owner,
      subject: `Mail in ${this.props.parcel!.address}`,
      content:
        this.state.content +
        `  
      -${this.user ? this.user.wallet : 'anon'}`,
    }

    fetch(process.env.API + `/mails/create`, {
      method: 'put',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          this.setState({ sent: true })
          setTimeout(() => {
            this.props.onClose!()
          }, 1500)
        } else {
          this.setState({ error: true })
        }
        this.setState({ sending: false })
      })
  }

  render() {
    return (
      <div>
        <button className="close" onClick={() => this.props.onClose!()}>
          &times;
        </button>
        <h3>Mail parcel owner.</h3>
        {this.state.sending && <h2>Sending...</h2>}
        {this.state.sent && <h2>Sent!</h2>}
        {this.state.error && <h2>Something went wrong.</h2>}

        <div className="f">
          <label>To:</label>
          <input readOnly={true} disabled={true} value={this.props.parcel!.address + ', ' + (this.props.parcel!.suburb || this.props.parcel!.island)} type="text" />
        </div>
        <div className="f">
          <label for="content">
            Message: <small>-Supports markdown-</small>
          </label>
          <textarea name="content" rows={6} value={this.state.content || ''} onInput={(e) => this.setState({ content: (e as any).target['value'] })}></textarea>
        </div>
        <button onClick={() => !this.state.sending && this.sendMail()} disabled={this.state.sending}>
          Send
        </button>
        <small>⚠️This service should not be considered secure. Use it for your convenience only. Do not share any personal information, including passwords and seed phrases.</small>
      </div>
    )
  }
}

export default function WriteMailOverlay(parcel: Parcel) {
  const div = document.createElement('div')
  div.className = 'overlay message-owner pointer-lock-close'
  document.body.appendChild(div)

  const onClose = () => {
    div && unmountComponentAtNode(div)
    div.remove()
    requestPointerLock()
  }

  render(<MailOwner parcel={parcel} onClose={onClose} />, div)

  exitPointerLock()
}
