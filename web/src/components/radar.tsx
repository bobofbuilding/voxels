import { Component } from 'preact'
import cachedFetch from '../helpers/cached-fetch'
import { encodeCoords } from '../../../common/helpers/utils'
import { getParcel } from '../store/index'
import { Animations } from '../../../src/avatar-animations'

export type MultiplayerUsersAPIResponse = {
  users: {
    name: string
    animation: Animations
    position: [number, number, number]
    lastSeen: string | null
  }[]
}

export interface Props {}

export interface State {
  users: MultiplayerUsersAPIResponse['users']
  fetching?: boolean
}

const TTL = 5

export default class Radar extends Component<Props, State> {
  interval: any

  constructor(props: any) {
    super(props)
    this.state = {
      fetching: true,
      users: [],
    }
  }

  componentDidMount() {
    this.fetch()

    this.interval = setInterval(this.fetch, TTL * 1000)
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  fetch = async () => {
    this.setState({ fetching: true })

    const endpoint = 'https://www.voxels.com/mp/api/users.json?ttl=15'

    const f = await cachedFetch(endpoint, {}, TTL)
    const r = (await f.json()) as MultiplayerUsersAPIResponse

    const { users } = r
    this.setState({ users, fetching: false })
  }

  render() {
    const trunc = 64

    const users = (this.state.users || [])
      .filter((u: any) => u.position)
      .map((u: any) => {
        const coords = { position: BABYLON.Vector3.FromArray(u.position) }
        const teleport = `/play?coords=` + encodeCoords(coords)
        const anon = !u.name
        const parcel = u.lastSeen && getParcel(u.lastSeen).value

        // <img src="http://localhost:4321/avatars/0x2d891ed45c4c3eab978513df4b92a35cf131d2e2" />

        return (
          <li title={u.name} class={anon ? 'anon' : ''} key={[teleport + u.lastSeen + u.wallet].join('-')}>
            <a href={teleport} title={u.name}>
              a
            </a>
          </li>
        )
      })
      .slice(0, trunc)

    if (this.state.fetching) {
      return
    }

    return <ul class="radar">{users}</ul>
  }
}
