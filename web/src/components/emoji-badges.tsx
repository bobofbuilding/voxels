import { isEqual } from 'lodash'
import { Component } from 'preact'
import { useState } from 'preact/hooks'
import { isInWorld } from '../../../common/helpers/detector'
import { AggregatedEmoji, Emoji, Emojiable_type, Emojis } from '../../../common/messages/emoji'
import { Spinner } from '../spinner'
import { app } from '../state'
import { fetchAPI, fetchOptions } from '../utils'
import { PanelType } from './panel'

interface Props {
  item: { id: string | number }
  emojiable_type: Emojiable_type
}

interface State {
  emojis?: AggregatedEmoji[]
  loading: boolean
  updating: boolean
  adding: boolean
}

const MAX_EMOJIS_PER_USER = 3

export default class EmojiBadges extends Component<Props, State> {
  abort: AbortController | null = null

  state: State = {
    emojis: [],
    adding: false,
    loading: true,
    updating: false,
  }

  static get emojis(): ReadonlyArray<Emoji> {
    return Emojis
  }

  get isInWorld() {
    return isInWorld()
  }

  get playerAddedEmojis() {
    if (!app.signedIn || !app.state.wallet) {
      return []
    }
    const playerWallet = app.state.wallet.toLowerCase()
    const playerEmojis = this.state.emojis?.filter((e) => {
      return !!e.authors.find((author) => author.toLowerCase() === playerWallet)
    })
    return playerEmojis || []
  }

  get id() {
    return this.props.item.id
  }

  worldEmote(emoji: Emoji) {
    if (!this.isInWorld) {
      return
    }
    // if in-world, show emojis in-world
    window.connector?.emote(emoji)
  }

  componentDidMount() {
    this.fetchEmojis()
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(this.props.item.id, prevProps.item.id)) {
      this.setState({ loading: true, emojis: [] })
      this.fetchEmojis()
    }
  }

  componentWillUnmount() {
    if (this.abort) {
      this.abort.abort('ABORT: quitting component')
      this.abort = null
    }
  }

  formatAPIUrl(): 'collectibles/w' | 'events' | 'womps' | 'parcels' {
    const type = this.props.emojiable_type
    switch (type) {
      case 'parcel_events':
        return 'events'
      case 'wearables':
        return 'collectibles/w'
      default:
        return type
    }
  }

  hasAddedEmoji(emoji: Emoji) {
    if (!app.signedIn || !app.state.wallet) return false

    const aggregatedEmoji = this.state.emojis?.find((e) => e.emoji === emoji)
    if (!aggregatedEmoji) return false

    return aggregatedEmoji.authors.includes(app.state.wallet)
  }

  moveBoxInWorld() {
    if (!this.isInWorld) {
      return
    }
    // This is a function to make sure the emojis fit inside the editor in-world
    const plusSign: HTMLElement | null = document.querySelector('.addEmoji')
    if (!plusSign) return
    const box: HTMLElement | null = document.querySelector('.emojis-box')
    if (!box) return
    box.style.left = `${-(plusSign.offsetLeft - 15) + plusSign.offsetWidth}px`
  }

  fetchEmojis(cachebust = false) {
    const opts = fetchOptions(this.setAbortController())
    opts.priority = 'high'
    opts.cache = cachebust ? 'reload' : undefined
    return fetchAPI(`/api/${this.formatAPIUrl()}/${this.id}/emojis.json`, opts)
      .then((r) => {
        this.setState({ emojis: r.emojis ?? [] }, this.moveBoxInWorld)
      })
      .catch(console.error)
      .finally(() => {
        this.setState({ loading: false })
        this.clearAbortController()
      })
  }

  addEmoji(emoji: Emoji) {
    this.setState({ updating: true, adding: false })

    const body = { emoji: emoji, emojiable_id: this.id, emojiable_type: this.props.emojiable_type }

    return fetchAPI(`/api/emojis/add`, fetchOptions(this.setAbortController(), JSON.stringify(body)))
      .then(() => this.fetchEmojis(true))
      .then(() => this.worldEmote(emoji))
      .catch((err) => {
        app.showSnackbar('Something went wrong...', PanelType.Danger)
        console.error(err)
      })
      .finally(() => {
        this.setState({ updating: false })
      })
  }

  removeEmoji(emoji: Emoji) {
    this.setState({ updating: true, adding: false })

    const body = { emoji: emoji, emojiable_id: this.id, emojiable_type: this.props.emojiable_type }
    return fetchAPI(`/api/emojis/remove`, fetchOptions(undefined, JSON.stringify(body)))
      .then(() => this.fetchEmojis(true))
      .catch((err) => {
        app.showSnackbar('Something went wrong...', PanelType.Danger)
        console.error(err)
      })
      .finally(() => {
        this.setState({ updating: false })
      })
  }

  render() {
    const emojiBadges = this.state.emojis?.map((e: AggregatedEmoji) => {
      const hasPlayerGivenEmoji = app.signedIn && e.authors.includes(app.state.wallet ?? '')
      return (
        <li>
          <EmojiBadge key={e.emoji} e={e} hasPlayerGivenEmoji={hasPlayerGivenEmoji} addEmoji={this.addEmoji.bind(this)} removeEmoji={this.removeEmoji.bind(this)} />
        </li>
      )
    })

    const emojin = EmojiBadges.emojis.map((e) => {
      const hasPlayerGivenEmoji = this.hasAddedEmoji(e)
      return (
        <li key={e} className={'emoji-icon' + (hasPlayerGivenEmoji ? ' has-owner-vote' : '')} onClick={() => (hasPlayerGivenEmoji ? this.removeEmoji(e) : this.addEmoji(e))}>
          {e}
        </li>
      )
    })

    const realm = this.isInWorld ? 'in-world' : 'on-web'

    return (
      <>
        <a onClick={() => this.setState({ adding: !this.state.adding })}>Like</a>
        <ul class="emoji-scores">
          <li>{this.state.adding ? <ul className="add-emoji">{emojin}</ul> : null}</li>
          {this.state.loading && <Spinner size={22} bg={this.isInWorld ? 'dark' : 'light'} />}
          {this.state.emojis && this.state.emojis?.length > 0 && emojiBadges}
        </ul>
      </>
    )
  }

  private setAbortController() {
    if (this.abort) {
      this.abort.abort('ABORT:starting new request')
      this.abort = null
    }
    this.setState({ loading: false })
    this.abort = new AbortController()
    return this.abort
  }

  private clearAbortController() {
    this.abort = null
  }
}

type EmojiBadgeProps = {
  e: AggregatedEmoji
  hasPlayerGivenEmoji: boolean
  removeEmoji?: (emoji: Emoji) => Promise<void>
  addEmoji?: (emoji: Emoji) => Promise<void>
}

function EmojiBadge(props: EmojiBadgeProps) {
  const [changing, setChanging] = useState<boolean>(false)

  const authorsList = (emoji: AggregatedEmoji) => {
    const names = []
    for (let i = 0; i < emoji.authors.length; i++) {
      const nameOrWallet = emoji.authors_name[i] && emoji.authors_name[i] !== 'null' ? emoji.authors_name[i] : emoji.authors[i]
      names.push(nameOrWallet.length > 12 ? nameOrWallet.substring(0, 12) + '...' : nameOrWallet)
    }
    return names.join('\n')
  }

  const clickAction = async () => {
    setChanging(true)
    if (props.hasPlayerGivenEmoji) {
      await props.removeEmoji?.(props.e.emoji)
    } else {
      await props.addEmoji?.(props.e.emoji)
    }
    setChanging(false)
  }

  return (
    <div key={props.e.emoji + 'score'} className={props.hasPlayerGivenEmoji ? 'emoji-badge has-owner-vote' : 'emoji-badge'} onClick={clickAction} title={`${authorsList(props.e)}`}>
      <span class={'emoji ' + (changing ? 'changing' : '')}>
        {props.e.emoji}
        <u>{props.e.total}</u>
      </span>
    </div>
  )
}
