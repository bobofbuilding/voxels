import { h } from 'preact'
import showAvatarHTMLUi from '../../ui/html-ui/avatar-ui'
import type { Scene } from '../../scene'
import { format } from 'timeago.js'
import { useEffect, useState } from 'preact/hooks'

export interface MessageProps {
  className?: string
  color?: string
  onUserNameClick?: () => void
  text: string
  username: string
  scene: Scene
  timestamp: number
}

interface UserNameProps {
  color?: string
  onUserNameClick?: () => void
  username: string
  timestamp: number
}

const UserNameElement = (props: UserNameProps) => {
  const onClick = props.onUserNameClick
  const username = props.username
  const key = `${props.timestamp}-user`

  if (!onClick) {
    return <span key={key}>{username}</span>
  }

  return (
    <a key={key} href="#" onClick={onClick}>
      {username}
    </a>
  )
}

export function Say(props: MessageProps) {
  return (
    <div className={props.className}>
      <p style={{ color: props.color }} className="say">
        {UserNameElement(props)}: {props.text}
      </p>
    </div>
  )
}

export function SayWithTags(props: MessageProps & { tags: string[] }) {
  const nearbyAvatars = window.connector.getNearbyAvatarsToSelf()
  const tags = props.tags
  let arrayOfComponents: (h.JSX.Element | string)[] = []
  if (!props.text) {
    throw new Error('SayWithTags: props.text is empty')
  }
  if (tags) {
    let tmpString = props.text
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i]

      const tag = t.slice(-t.length + 1).toLowerCase() // remove the '@'
      // Check if tag corresponds to a nearby avatar

      const talkedAboutAvatar = nearbyAvatars.find((a) => a.name?.toLowerCase() === tag || a.wallet?.toLowerCase() === tag)

      const splitted = tmpString.split(t)
      tmpString = splitted[1]
      arrayOfComponents.push(splitted[0])
      if (!talkedAboutAvatar || t == 'anonymous') {
        // no avatar or tag is 'anonymous', ignore
        arrayOfComponents.push(t)
        continue
      }

      arrayOfComponents.push(
        <span key={`${props.timestamp}-tag-${i}`} className="-chat-user-tag" onClick={() => showAvatarHTMLUi(talkedAboutAvatar, props.scene)}>
          {t}
        </span>,
      )
    }
    arrayOfComponents.push(tmpString)
  } else {
    arrayOfComponents = [props.text]
  }

  return (
    <p>
      {UserNameElement(props)}: {arrayOfComponents}
    </p>
  )
}

const InWorldLink = (props: { text: string }) => {
  // We receive a message that looks like `/play?coords=` so grab the coords only

  const url = new URL(props.text, process.env.ASSET_PATH)
  const coords = new URLSearchParams(url.search.substring(1)).get('coords')

  function teleportTo(coords: string) {
    // If coords are bad you will be teleported to the origin
    window.persona.teleport(coords)
  }

  return (
    <a onClick={() => teleportTo(props.text)} title="Click to teleport">
      [Teleport to {coords}]
    </a>
  )
}

export function TeleportLink(props: MessageProps) {
  return (
    <div className={props.className}>
      <p style={{ color: props.color }} className="say">
        {UserNameElement(props)}: <InWorldLink text={props.text} />
      </p>
    </div>
  )
}
