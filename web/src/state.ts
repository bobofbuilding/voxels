import { signal } from '@preact/signals'
import { EventEmitter } from 'events'
import Cookies from 'js-cookie'
import { decodeJwt } from 'jose'
import { ApiAvatar, ApiAvatarMessage } from '../../common/messages/api-avatars'
import { validateMessageResponse } from '../../common/messages/validate'
import Snackbar from './components/snackbar'
import { fetchAPI } from './utils'

const NAME_KEY = 'cv-name-key'

export interface Message {
  type: 'visit' | 'chat' | 'join' | 'leave' | 'navigate' | 'teleport'
  sender?: string
  createdAt?: Date
  data?: string
}

const VOXELS_TEAM = ['0x2D891ED45C4C3EAB978513DF4B92a35Cf131d2e2', '0x86b6Dcc9eb556e55485d627e5D4393b616A8Afb8', '0xa13b052759aC009D4b7643f61E77FeC54492f446', '0x0fA074262d6AF761FB57751d610dc92Bac82AEf9'].map((w) => w.toLowerCase())

const MESSAGE_CHANNEL = 'channel'

type NamesObject = {
  names: string[]
  name: string
}

export enum AppEvent {
  Load = 'load',
  Login = 'login',
  Logout = 'logout',
  AvatarLoad = 'avatar-load', // event for when we got all the user info from the db
  Change = 'change',
  ProviderMessage = 'provider-message',
}

export interface StateObject {
  loading?: boolean
  wallet: string | null
  moderator?: boolean
  name?: string
  unverifiedWallet?: string
  unreadMailCount: number
  key?: string
  costume?: any
  settings?: { quietMails?: boolean }
  hideInstructions?: boolean
}

export interface RequestArguments {
  method: string
  params?: unknown[] | object
}

class State extends EventEmitter {
  state: StateObject
  stateLoadedCallbacks: Array<(state: StateObject) => void> = []

  constructor() {
    super()

    this.state = {
      wallet: null,
      unreadMailCount: 0,
      key: null!,
      costume: {},
      settings: {},
    }
  }

  setState(args: Partial<StateObject>) {
    Object.assign(this.state, args)
    this.emit(AppEvent.Change)

    if (args.loading === false) {
      while (this.stateLoadedCallbacks.length) {
        const callback = this.stateLoadedCallbacks.shift()
        if (!callback) continue
        callback(this.state)
      }
    }
  }
}

export class Appstate extends State {
  rememberSignIn = false
  showSnackbar = Snackbar.show ?? console.log
  visitUrl = signal<string | undefined>(undefined)
  private lastOnlineIntervalHandle: NodeJS.Timeout | null = null

  constructor() {
    super()

    try {
      if (typeof window === 'undefined') {
        return
      }
      if (typeof localStorage === 'undefined') {
        return
      }
    } catch (e) {
      // sandboxed iframe
      console.log('sandboxed iframe')
    }

    this.on(AppEvent.AvatarLoad, () => {
      this.subscribeLastOnline()
    })
    this._initiate()

    window.addEventListener('storage', this.onStorage)
  }

  isAdmin() {
    return VOXELS_TEAM.includes(this.state.wallet?.toLowerCase() ?? '')
  }

  get hasMetamask(): boolean {
    return !!window.ethereum && window.ethereum?.isMetaMask
  }

  get hasWeb3Extension() {
    return !!window.ethereum && !this.hasMetamask
  }

  get signedIn() {
    return !!this.state.wallet
  }

  get isMobile() {
    return typeof navigator !== 'undefined' && navigator.userAgent.match(/mobile/i)
  }

  get wallet() {
    return this.state.wallet
  }

  onStorage = (e: StorageEvent) => {
    if (e.key == MESSAGE_CHANNEL && e.newValue) {
      const msg = JSON.parse(e.newValue) as Message
      if (msg.type == 'teleport' && msg.data?.match('/play')) {
        const coords = msg.data.slice(5)
        window.persona.teleport(coords)
      }
    }
  }

  send(message: Message) {
    const nonce = Math.random()
    this.localStorage?.setItem(MESSAGE_CHANNEL, JSON.stringify({ ...message, nonce }))
  }

  get localStorage(): Storage | undefined {
    try {
      return localStorage
    } catch (e) {
      // sandboxed iframe
      console.log('sandboxed iframe')
      return
    }
  }

  async setKey(key: string) {
    try {
      const payload = decodeJwt(key) as any
      const wallet: string | undefined = payload?.wallet?.toLowerCase()

      this.setState({
        key,
        wallet,
      })

      let fetchPing, resultPing
      try {
        fetchPing = await fetch('/api/ping')
        resultPing = await fetchPing.json()
      } catch {
        console.debug('Signin fetch failed')
        this.signout()
        return
      }

      if (!resultPing.success) {
        console.debug('Signin, ', resultPing)
        return this.signout()
      }
    } catch (e) {
      console.debug('Signin error, ', e)
      this.signout()
    }
  }

  setName(name: string | undefined) {
    this.setState({ name })
  }

  async markMailAsRead(mailId: number) {
    const r = await fetch(`${process.env.API}/mails/read`, {
      method: 'put',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: mailId,
      }),
    })
    const mail = await r.json()
    this.setState({ unreadMailCount: parseInt(mail.unreadCount) })
  }

  signout() {
    this.localStorage?.removeItem(NAME_KEY)
    this.localStorage?.removeItem('cv-wearables-owned') // remove localstorage for wearables owned

    Cookies.remove('jwt')

    this.setState({
      wallet: null!,
      key: null!,
      moderator: false,
      unreadMailCount: 0,
      name: null!,
      costume: {},
    })

    this.unsubscribeLastOnline()
    this.emit(AppEvent.Logout)
  }

  async fetchNames(): Promise<NamesObject> {
    const f = await fetch(`/api/avatar/${this.state.wallet}/names`)
    if (!f.ok) throw new Error('Could not fetch names')

    return await f.json()
  }

  subscribeLastOnline() {
    this.updateLastOnline()
    if (this.lastOnlineIntervalHandle) clearInterval(this.lastOnlineIntervalHandle)
    this.lastOnlineIntervalHandle = setInterval(this.updateLastOnline.bind(this), 30e3)
  }

  unsubscribeLastOnline() {
    if (this.lastOnlineIntervalHandle) clearInterval(this.lastOnlineIntervalHandle)
  }

  updateLastOnline() {
    if (!this.state?.wallet) {
      console.log('no wallet in updateLastOnline')
      return
    }
    fetchAPI(`/api/avatar/${this.state?.wallet}/online`, { method: 'POST' }).catch(console.error)
  }

  async onLoad() {
    this.loadAvatar()
  }

  async loadAvatar(nonce?: boolean) {
    if (!this.signedIn || !this.state.wallet) {
      console.error('Can not load avatar if not logged in')
      return
    }
    this.setState({ loading: true })
    let url = `/api/avatars/${this.state.wallet.toLowerCase()}.json`
    if (nonce) {
      url += '?nonce=' + Math.random() * 1000
    }

    const res = await fetch(url)
    const data = await validateMessageResponse(ApiAvatarMessage)(res)

    const name = data.avatar?.name ?? undefined // || (data.avatar?.owner && data.avatar?.owner?.slice(0, 10) + '...') || 'anonymous'
    const moderator = (data.avatar && data.avatar.moderator) || false
    const costume = (data.avatar && data.avatar.costume) || {}
    const settings = (data.avatar && data.avatar.settings) || {}

    this.setState({ name, moderator, costume, settings, loading: false })
    this.emit(AppEvent.AvatarLoad)
  }

  async setAvatar(changes: Partial<ApiAvatar>) {
    const result = await fetch(process.env.API + `/avatar`, {
      method: 'post',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(changes),
    })

    await result.json()
    app.loadAvatar(true)

    console.log('Settings saved.')
  }

  /**
   * Await the state to ensure it is loaded before using
   */
  getState(): Promise<StateObject> {
    return new Promise((resolve) => {
      if (this.state.loading) {
        this.stateLoadedCallbacks.push(resolve)
      } else {
        resolve(this.state)
      }
    })
  }

  private async _initiate() {
    if (!document['addEventListener']) {
      return
    }

    const name = this.localStorage?.getItem(NAME_KEY)
    if (name) {
      this.setState({ name })
    }

    try {
      var jwtKey = Cookies.get('jwt')
    } catch (e) {
      console.log('sandboxed iframe, no jwt')
    }

    if (jwtKey) {
      await this.setKey(jwtKey)
    } else {
      // clean name if we dont have a JWT
      this.setState({ name: undefined })
    }
  }
}

export const app = new Appstate()

// For debugging
if (typeof window !== 'undefined') {
  window.app = app
}
