import { useEffect, useRef, useState } from 'preact/hooks'
import Avatar from '../../avatar'

export function NearByPlayers() {
  const [players, setPlayers] = useState<Avatar[]>([...window.connector.getNearbyAvatarsToSelf()])
  const ref = useRef<NodeJS.Timeout | null>(null)
  const refreshPlayers = () => {
    if (window.persona.avatar?.position) {
      setPlayers([...window.connector.getNearbyAvatarsToSelf()])
    } else {
      setPlayers([])
    }
  }

  useEffect(() => {
    refreshPlayers()
    if (!ref.current) {
      ref.current = setInterval(() => {
        refreshPlayers()
      }, 1000)
    }
    return () => {
      ref.current && clearInterval(ref.current)
      ref.current = null
    }
  }, [])

  const teleport = (p: Avatar) => {
    confirm(`Teleport to ${p.name}?`) && window.persona.teleport(`/play?coords=${p.coords}`)
  }

  return (
    <div class="nearby-players">
      <ul>
        {players.map((p) => {
          return (
            <li key={p.uuid} onClick={() => teleport(p)} onMouseOver={() => p.highlight()} onMouseLeave={() => p.unhighlight()}>
              <span class="player-name">{p.name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
