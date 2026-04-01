import { Say, SayWithTags, TeleportLink } from '../../components/chat/messages'
import showAvatarHTMLUi from '../../ui/html-ui/avatar-ui'
import type { Scene } from '../../scene'
import { ChatMessageRecord } from '../../connector'

interface MessageProps {
  message: ChatMessageRecord
  scene: Scene
}

const tagRegex = /@[\w-]+/g
export default function ChatMessage(props: MessageProps) {
  const avatar = props.message.avatar ? window.connector.findAvatar(props.message.avatar) : null
  const username = avatar?.description?.name || avatar?.description?.wallet?.substring(0, 10) || props.message.name || 'anon'

  const isYou = avatar?.isUser
  const color = (avatar && avatar.color) || '#eee'
  let className = ''

  if (isYou) {
    className += ' -you'
  }

  let onClick: (() => void) | undefined = undefined
  if (avatar) {
    const current = window.connector.findAvatar(avatar.uuid)
    // don't show clickable name for yourself or for user without a position or wallet
    if (!avatar?.isUser && current?.hasPosition && current?.wallet) {
      onClick = () => showAvatarHTMLUi(current, props.scene)
    }
  }

  const message = props.message.text.slice(5) // remove the `/say`

  const tags = message.match(tagRegex) // catch tags like @Fayelure and @Fayelure.eth
  // if we are in world and someone posts a link, we want to show it as a teleport link
  const worldLink = props.scene.config.isGrid ? tryGetWorldLink(message) : null

  if (worldLink) {
    return <TeleportLink color={color} username={username} onUserNameClick={onClick} text={worldLink} className={className} scene={props.scene} timestamp={props.message.timestamp} />
  } else if (!tags?.length) {
    return <Say color={color} username={username} onUserNameClick={onClick} text={message} className={className} scene={props.scene} timestamp={props.message.timestamp} />
  } else {
    return <SayWithTags color={color} tags={tags} username={username} onUserNameClick={onClick} text={message} className={className} scene={props.scene} timestamp={props.message.timestamp} />
  }
}

/**
 * Checks if the message is a valid in-world link for teleport; If it is returns a safe teleport link
 */
function tryGetWorldLink(message: string): string | null {
  let url: URL | null
  try {
    url = new URL(message)
  } catch (e) {
    return null
  }
  if (!url) {
    return null
  }
  const path = url.pathname + url.search
  if (!(url.pathname.includes('/play') && !url.pathname.includes('/spaces') && path.includes('coords='))) {
    return null
  }
  return url.pathname + url.search
}
