import { render } from 'preact'
import { SUPPORTED_CHAINS_BY_ID } from '../../../common/helpers/chain-helpers'
import { exitPointerLock } from '../../../common/helpers/ui-helpers'
import Connector from '../../../src/connector'
import Persona from '../../../src/persona'
import { openMailboxUI } from '../../../web/src/components/mailbox/mailbox-ui'
import { PanelType } from '../../../web/src/components/panel'
import ReportButton from '../../../web/src/components/report-button'
import { app } from '../../../web/src/state'
import Avatar from '../../avatar'
import ParcelOwnerActions from '../../components/avatar-ui/parcel-owner-action'

import { unmountComponentAtNode } from 'preact/compat'
import { ApiAvatar } from '../../../common/messages/api-avatars'
import { CollectibleInfoRecord } from '../../../common/messages/feature'
import type { Scene } from '../../scene'
import { HTMLUi } from './html-ui'

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

type Props = {
  avatar: Avatar
  onClose: () => void
  className?: string
  scene: Scene
}
type State = {
  collectibles: (CollectibleInfoRecord & { wearable_id: number })[]
  avatar: Avatar
  avatarInfo: ApiAvatar | null
  banReason: string | null
  status?: string
  loading?: boolean
  blockReason?: string | null
  suspended?: boolean
}

export class AvatarHTMLUi extends HTMLUi<Props, State> {
  static currentElement: HTMLDivElement

  constructor(props: Props) {
    super()

    this.state = {
      collectibles: [],
      avatar: props.avatar /* The avatar object */,
      avatarInfo: null /* The avatar info from DB */,
      banReason: null /* The Reason for banning */,
    }
  }

  get avatar() {
    return this.state.avatar as Avatar
  }

  get avatarInfo() {
    return this.state.avatarInfo
  }

  get connector(): Connector {
    return window.connector
  }

  get persona(): Persona | null {
    return window.persona
  }

  get wallet() {
    return this.avatar.description.wallet
  }

  get name() {
    return this.avatar.description.name
  }

  get isMod() {
    return !!this.avatarInfo?.moderator
  }

  get attachments() {
    return !!this.state.collectibles && this.state.collectibles
  }

  componentDidMount() {
    this.fetchavatarDescription()
    this.fetchWearables()
  }

  fetchavatarDescription() {
    this.setState({ loading: true })
    const url = `/api/avatars/${this.wallet}.json`

    return fetch(url)
      .then((r) => r.json())
      .then((r) => {
        if (r.success && r.avatar) {
          this.setState({ avatarInfo: r.avatar })
        }
        this.setState({ loading: false })
      })
  }

  fetchWearables() {
    if (!this.wallet) {
      return
    }
    return fetch(`/api/avatars/${this.wallet}/costume/collectibles.json`)
      .then((r) => r.json())
      .then((r) => {
        this.setState({ collectibles: r.collectibles || [] })
      })
  }

  redirect() {
    window.open(`/avatar/${this.wallet}`, '_blank')
  }

  suspend(days: number) {
    if (!this.state.blockReason) {
      app.showSnackbar("Can't suspend user without a reason", PanelType.Danger)
      return
    }

    const body = { reason: this.state.blockReason, days } /*add can_chat:true or can_build:true to allow those. */

    const url = `/api/avatar/${this.wallet}/suspend`

    return fetch(url, {
      headers,
      method: 'post',
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then(() => {
        this.setState({ suspended: true })
      })
  }

  unsuspend() {
    const body = {} /*add can_chat:true or can_build:true to allow those. */
    return fetch(`/api/avatar/${this.wallet}/unsuspend`, {
      headers,
      method: 'post',
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then(() => {
        this.setState({ suspended: false })
      })
  }

  close() {
    this.props.onClose()
  }

  render() {
    const attachments = this.state.collectibles.map((c) => {
      return (
        <li>
          <div>
            <a href={`/collections/${SUPPORTED_CHAINS_BY_ID[c.chain_id]}/${c.collection_address}/${c.wearable_id}`}>{c.name}</a>
            <small>{'Collection: ' + c.collection_name}</small>
          </div>
        </li>
      )
    })

    const suspendButton = (days: number) => (
      <button
        onClick={() => {
          this.setState({ blockReason: prompt('Please enter a reason') }, () => {
            this.suspend(days)
          })
        }}
      >
        Suspend user for {days} days (build and chat)
      </button>
    )

    const teleport = (p: Avatar) => {
      window.persona.teleport(`/play?coords=${p.coords}`)
      this.close()
    }

    return (
      <div className={`OverlayWindow -auto-height -avatar`}>
        <header>
          <h3>{this.avatar.description.name ? (this.isMod ? `${this.name + ' (mod)'}` : this.name) : this.wallet?.substring(0, 10) || 'anon'}</h3>
          <button className="close" onClick={() => this.close()}>
            &times;
          </button>
        </header>
        {this.wallet ? (
          <section className="SplitPanel">
            <div className="Panel">
              <div className="OverlayHighlightContent">
                <h4>Description</h4>
                <p>{this.state.loading ? 'Loading...' : this.avatarInfo?.description || 'No description for this avatar.'}</p>
              </div>
              <div className="OverlayHighlightContent">
                <h4>Currently wearing</h4>
                {attachments.length == 0 ? <p>This avatar is not wearing anything</p> : <ul className="ui-wearable-list">{attachments}</ul>}
              </div>
            </div>
            <div className="Panel">
              <div className="OverlayHighlightContent">
                <p>
                  <button
                    onClick={() => {
                      this.redirect()
                    }}
                  >
                    View profile
                  </button>
                  {app.signedIn && (
                    <button
                      onClick={() => {
                        app.signedIn && openMailboxUI(this.wallet)
                      }}
                    >
                      Message
                    </button>
                  )}
                  {this.avatarInfo && (
                    <ReportButton type="avatar" item={this.avatarInfo}>
                      <option value="User is racist or discriminative">User is racist or discriminative</option>
                      <option value="User's actions are against the community guidelines">User's actions are against the community guidelines</option>
                      <option value="User is making me feel uncomfortable">User is making me feel uncomfortable</option>
                      <option value="Other (please describe)">Other (please describe)</option>
                    </ReportButton>
                  )}
                </p>
                <p>{this.avatar.coords && <button onClick={() => teleport(this.avatar)}>Teleport</button>}</p>
                {this.wallet && (
                  <div className="OverlayHighlightContent -wallet">
                    <h4>Wallet Address</h4>
                    <p>{this.wallet}</p>
                  </div>
                )}
              </div>
              <ParcelOwnerActions avatar={this.state.avatar} scene={this.props.scene} />
              {app.signedIn && app.state.moderator && (
                <div class="OverlayHighlightContent -moderator">
                  <h4>Moderation Actions</h4>
                  {this.state.suspended ? (
                    <div>
                      <p>This user is currently suspended</p>
                      <p>
                        <button
                          onClick={() => {
                            this.unsuspend()
                          }}
                        >
                          Undo Suspend
                        </button>
                      </p>
                    </div>
                  ) : (
                    <div>
                      {suspendButton(7)}
                      {suspendButton(30)}
                    </div>
                  )}
                  <p></p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="Panel">
            <p>This user is not logged in.</p>
            {this.avatar.coords && <button onClick={() => teleport(this.avatar)}>Teleport</button>}
          </div>
        )}
      </div>
    )
  }
}

export default function showAvatarHTMLUi(avatar: Avatar, scene: Scene) {
  if (!!AvatarHTMLUi.currentElement) {
    unmountComponentAtNode(AvatarHTMLUi.currentElement)
    AvatarHTMLUi.currentElement = null!
    AvatarHTMLUi.close()
  }
  const div = document.createElement('div')
  div.className = 'pointer-lock-close avatar-ui'
  document.body.appendChild(div)
  AvatarHTMLUi.currentElement = div

  const onClose = () => {
    unmountComponentAtNode(div)
    div.remove()
    AvatarHTMLUi.currentElement = null!
    HTMLUi.close()
  }

  render(<AvatarHTMLUi avatar={avatar} onClose={onClose} scene={scene} />, div)

  exitPointerLock()
}
