import { Component, createRef, JSX } from 'preact'
import { forwardRef } from 'preact/compat'
import { useEffect, useState } from 'preact/hooks'
import TextInput from 'react-autocomplete-input'
import { isMobile } from '../../../common/helpers/detector'
import { Emojis, replaceEmojiText, replaceEmoticonsAndEmojiText } from '../../../common/helpers/emojis'
import { Emotes } from '../../../common/messages/constant'
import { PanelType } from '../../../web/src/components/panel'
import { app } from '../../../web/src/state'
import Avatar from '../../avatar'
import Connector, { ChatChannel, ChatMessageRecord } from '../../connector'
import GuestBook from '../../features/guest-book'
import Persona from '../../persona'
import type { Scene } from '../../scene'
import { NearByPlayers } from './nearby-players'

// Type assertion to help TypeScript understand this React component works with Preact
const TypedTextInput = TextInput as any

const EMOTES = new RegExp(Emotes.join('|'), 'gi')

interface Props {
  scene: Scene
  focusChatInput?: () => void
}

type TimeStamp = number
type State = {
  messages: Record<ChatChannel, ChatMessageRecord[]>
  channel: ChatChannel
  nearby: Avatar[]
  lastRead: Record<ChatChannel, TimeStamp>
  focusTime: TimeStamp
  focused: boolean
}

const MAX_CHAT_LENGTH = 256 // no one wants to hear your life story, keep it short

const STORAGE_CHANNEL_KEY = 'last_chat_channel'

const getInitialChannel = (): ChatChannel => {
  try {
    const stored = globalThis.localStorage.getItem(STORAGE_CHANNEL_KEY)
    if (stored && stored === 'global') return 'global'
  } catch (err) {
    console.error(err)
  }
  return 'local'
}

const storeSelectedChannel = (channel: ChatChannel) => {
  try {
    globalThis.localStorage.setItem(STORAGE_CHANNEL_KEY, channel)
  } catch (err) {
    console.error(err)
  }
}

export class ChatOverlay extends Component<Props, State> {
  lastSentTyping: number | null = null
  inputRef: preact.RefObject<HTMLDivElement>
  static instance: ChatOverlay | null = null
  constructor(props: Props) {
    super(props)

    const channel = props.scene.config.isSpace ? 'local' : getInitialChannel()

    this.state = {
      messages: this.connector.messages,
      channel,
      nearby: [],
      lastRead: {
        local: Date.now(),
        global: Date.now(),
      },
      focused: false,
      focusTime: 0,
    }
    this.inputRef = createRef<HTMLDivElement>()
    ChatOverlay.instance = this
  }

  get connector(): Connector {
    return window.connector
  }

  get persona(): Persona {
    return this.connector.persona
  }

  get messagesDiv() {
    // fixme: there MUST be a better way :/
    return document.querySelector('.InteractOverlay .ChatMessages')
  }

  get isDPadVisible() {
    return !!(this.connector.controls as any).dpad
  }

  refreshMessages = () => {
    this.setState({ messages: this.connector.messages })
  }

  componentDidMount() {
    this.connector.onMessagesChange.add(this.refreshMessages)
    this.refreshMessages()
    this.scrollToBottom()
  }

  componentWillUnmount() {
    this.connector.onMessagesChange.removeCallback(this.refreshMessages)
  }

  typing = () => {
    const now = Date.now()
    if (!this.lastSentTyping || now - this.lastSentTyping > 4e3) {
      this.lastSentTyping = now
      this.connector.typing()
    }
  }

  focusInput() {
    const input = this.inputRef.current?.querySelector('input')
    input?.focus()
  }

  onChatInputFocus = (bool: boolean) => {
    this.setState({ focused: bool })
  }

  scrollToBottom() {
    try {
      if (this.messagesDiv) {
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight
      }
    } catch (e) {}
  }

  changeChannel(channel: ChatChannel) {
    this.setState((prev) => {
      return { channel, lastRead: { ...prev.lastRead, [prev.channel]: Date.now() }, focusTime: Date.now() }
    })
    storeSelectedChannel(channel)
  }

  unreadCount(channel: ChatChannel) {
    if (this.state.channel === channel) {
      return 0 // no unread, assuming you can read
    }
    // iterate backwards as messages are sorted by timestamp
    let unread = 0
    for (let i = this.state.messages[channel].length - 1; i >= 0; i--) {
      const message = this.state.messages[channel][i]
      if (message.timestamp > this.state.lastRead[channel]) {
        unread++
      } else {
        break
      }
    }

    return unread
  }

  componentDidUpdate() {
    this.scrollToBottom()
  }

  render() {
    const name = (m: ChatMessageRecord) => {
      const avatar = m.avatar ? window.connector.findAvatar(m.avatar) : null
      return avatar?.description?.name || avatar?.description?.wallet?.substring(0, 10) || m.name || 'anon'
    }

    return (
      <main class="chat">
        <NearByPlayers />

        <div class={'chat-messages'}>
          {this.state.messages[this.state.channel].map((m) => (
            <div>
              {name(m)}: {m.text}
            </div>
          ))}
        </div>

        <ChatInput typing={this.typing} channel={this.state.channel} onFocusChange={this.onChatInputFocus} focusTime={this.state.focusTime} ref={this.inputRef} />
      </main>
    )
  }
}

function ChannelButton({ channel, active, onClick, unread }: { channel: ChatChannel; active: boolean; onClick: () => void; unread: number }) {
  const iconForChannel = (channel: ChatChannel) => {
    switch (channel) {
      case 'global':
        return 'fi-globe'
      case 'local':
        return 'fi-group'
      default:
        const _never: never = channel
        return ''
    }
  }

  return (
    <button onClick={onClick} disabled={active} className={`channel${active ? ' -active' : ''}`}>
      <i className={iconForChannel(channel)} />
      {channel}
      <span className={'count' + (unread === 0 ? ' zero' : '')}>{unread}</span>
    </button>
  )
}

const sign = async () => {
  const parcel = window.grid?.currentParcel()
  if (!parcel) {
    app.showSnackbar('Not in a parcel. Please step into a parcel with a guestbook to sign it', PanelType.Danger)
    return
  }
  const guestbook = parcel.getFeaturesByType('guest-book')[0] as GuestBook | undefined
  if (!guestbook) {
    app.showSnackbar('No Guestbook on parcel', PanelType.Danger)
    return
  }
  if (guestbook.hasUserSigned) {
    app.showSnackbar(`You have already signed this parcel's Guestbook`, PanelType.Danger)
    return
  }
  if (!guestbook.signChatCommandEnabled) {
    app.showSnackbar(`This command is not allowed in this parcel`, PanelType.Danger)
    return
  }
  try {
    const hasSigned = await guestbook.signGuestBook()
    if (hasSigned) {
      app.showSnackbar(`You have signed this parcel's Guestbook`, PanelType.Success)
    }
  } catch (err: any) {
    app.showSnackbar(`Error signing guestbook: ${err?.message}`, PanelType.Warning)
  }
}

async function bulkEmote(emotes: Iterable<string>) {
  let count = 0
  for (const emote of emotes) {
    if (count > 3) {
      return
    }
    window.connector.emote(emote)
    count++
    // wait a few ms between emotes, try to avoid being ip banned for spamming
    await new Promise((res) => setTimeout(res, 333))
  }
}

const getNearbyAvatarsNames = () => {
  return window.connector
    .getNearbyAvatarsToSelf()
    .filter((a) => a.wallet)
    .map((a) => a.name)
}

type AutoCompleteOptions = Record<string, Readonly<string[]>>
// generate once, use forever
const emojiMatches = Emojis.map((e) => e + ':')

const ChatInput = forwardRef<HTMLDivElement, { typing: () => void; channel: ChatChannel; onFocusChange?: (bool: boolean) => void; focusTime: TimeStamp }>(({ typing, onFocusChange, channel, focusTime }, ref) => {
  const [currentMessage, setMessage] = useState<string>('')

  const [autocompleteOptions, setAutocompleteOptions] = useState<AutoCompleteOptions>({
    '@': getNearbyAvatarsNames(),
    ':': emojiMatches,
  })

  let lastUpdate = Date.now()
  const refreshPlayers = () => {
    lastUpdate = Date.now()
    setAutocompleteOptions({
      '@': getNearbyAvatarsNames(),
      ':': emojiMatches,
    })
  }

  const handleRequestOptions = () => {
    // only update at max 1 time per second
    if (Date.now() - lastUpdate < 1000) {
      return
    }
    // only update player autocomplete options if the user is typing a new name
    refreshPlayers()
  }

  const say = () => {
    const message = replaceEmoticonsAndEmojiText(currentMessage.trim())
    if (!message) return

    if (message.length > MAX_CHAT_LENGTH) {
      app.showSnackbar('This is not a blog site, keep it short.')
      return
    }

    // Reset input early to avoid double sending
    setMessage('')

    if (message.startsWith('/sign')) {
      // Special /sign command to allow users to sign a guestbook from whereever
      return sign()
    }

    try {
      connector.say(message, channel)
    } catch (e: any) {
      app.showSnackbar(e?.message ?? 'Error sending message', PanelType.Danger, 5000)
      return
    }
    const emotes = EMOTES.exec(message)
    if (emotes?.length) {
      // if the message contains valid emotes, emote them as well as say them
      bulkEmote(new Set(emotes))
    }
  }

  const onChatKeydown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    const message = e.currentTarget.value //inputRef.current?.value
    if (e.key === 'Enter') {
      if (message?.length) {
        say()
        // Unfocus on mobile since the keyboard takes too much space
        isMobile() && e.currentTarget.blur()
      }
      e.preventDefault()
    } else {
      // setMessage(replaceEmojiText(message))
      typing()
    }

    if (e.key === 'Escape') {
      // close()
    }
  }

  useEffect(() => {
    if (focusTime > 0) document.querySelector<HTMLInputElement>('.ChatInput input')?.focus()
  }, [focusTime])

  const connector = window.connector

  const enabled: boolean = connector.canChatOnChannel(channel)

  const placeholder = 'chat'

  return (
    <div class="ChatInput" ref={ref}>
      <TypedTextInput
        Component="input"
        value={currentMessage}
        maxOptions={3}
        minChars={1}
        trigger={['@', ':']}
        options={autocompleteOptions}
        disabled={!enabled}
        placeholder={placeholder}
        onKeyDown={onChatKeydown}
        onfocus={() => onFocusChange && onFocusChange(true)}
        onblur={() => onFocusChange && onFocusChange(false)}
        passThroughEnter={false}
        onChange={(message: string) => setMessage(replaceEmojiText(message))}
        maxLength={MAX_CHAT_LENGTH}
        enterkeyhint="send"
        onRequestOptions={handleRequestOptions}
        requestOnlyIfNoOptions={true}
      />
    </div>
  )
})
