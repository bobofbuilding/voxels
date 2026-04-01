import { MetaMaskInpageProvider } from '@metamask/providers'
import { Contract, BrowserProvider, Signer } from 'ethers'
import Cookies from 'js-cookie'
import { decodeJwt } from 'jose'
import { ssrFriendlyWindow } from '../../../common/helpers/utils'
import { ApiAvatar, ApiAvatarMessage } from '../../../common/messages/api-avatars'
import { validateMessageResponse } from '../../../common/messages/validate'
import { PanelType } from '../components/panel'
import Snackbar from '../components/snackbar'
import { app, Appstate, StateObject } from '../state'
import { changeNetwork, getCurrentChainId, getUserAccounts, signMessage } from './login-helper'

const isNode = new Function('try {return this===global;}catch(e){return false;}')

const ParcelContract = require('../../../common/contracts/parcel.json')

export const NAME_KEY = 'cv-name-key'

const jsonHeaders = {
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
}

enum AppEvent {
  Load = 'load',
  Login = 'login',
  Logout = 'logout',
  AvatarLoad = 'avatar-load', // event for when we got all the user info from the db
  ErrorLogin = 'error-login',
  Change = 'change',
  ProviderMessage = 'provider-message',
}

export class StateLogin {
  signer: Signer | null = null
  provider: MetaMaskInpageProvider | null = null
  contract: Contract | null = null
  rememberSignIn = false
  showSnackbar = Snackbar.show ?? console.log
  private message: string | null = null
  #app: Appstate

  constructor(state: Appstate) {
    this.#app = state

    this._initiate()
  }

  get state(): StateObject {
    return this.#app.state
  }

  get hasMetamask(): boolean {
    return !!window.ethereum && window.ethereum?.isMetaMask
  }

  get signedIn() {
    return !!this.state.wallet
  }

  get isMobile() {
    return typeof navigator !== 'undefined' && navigator.userAgent.match(/mobile/i)
  }

  get localStorage(): Storage | undefined {
    try {
      return window.localStorage
    } catch (e) {
      return undefined
    }
  }

  setState(args: Partial<StateObject>) {
    this.#app.setState(args)
  }

  private async setKey(key: string) {
    try {
      const payload = decodeJwt(key) as any
      const wallet: string | undefined = payload?.wallet?.toLowerCase()

      this.setState({
        key,
        wallet,
      })

      // this.enable()
      let fetchPing, resultPing
      try {
        fetchPing = await fetch('/api/ping')
        resultPing = await fetchPing.json()
      } catch {
        console.debug('Signin fetch failed')
        this.#app.signout()
        return
      }

      if (!resultPing.success) {
        console.debug('Signin, ', resultPing)
        return this.#app.signout()
      }
    } catch (e) {
      console.debug('Signin error, ', e)
      this.#app.signout()
    }
  }

  setName(name: string) {
    this.setState({ name })
  }

  fetchUnreadCount = () => {
    if (!this.state.wallet) return

    // fixme
  }

  markMailAsRead(mailId: number) {
    fetch(`${process.env.API}/mails/read`, {
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
      .then((r) => r.json())
      .then((r) => {
        this.setState({ unreadMailCount: parseInt(r.unreadCount) })
      })
  }

  ethersWeb3Provider(): BrowserProvider {
    const provider = this.provider
    if (provider && provider instanceof BrowserProvider) {
      return provider as BrowserProvider
    }

    return new BrowserProvider(provider as any)
  }

  /**
   * We set the etherJS signer, which is necessary for ether JS write interactions with contracts.
   * @returns
   */
  async setSigner() {
    if (!this.provider) {
      console.warn('No selected login')
      return
    }
    //new VoidSigner(this.state.unverifiedWallet, this.provider)
    // voidSigners can't sign signatures
    const prov = this.ethersWeb3Provider()
    this.signer = prov.getSigner() as any
    this.onSetSigner()
  }

  async getChainId() {
    await this.refreshProvider()
    if (!this.provider) {
      throw new Error('Provider not available')
    }
    return await getCurrentChainId(this.provider)
  }

  getSigner() {
    if (!this.signer) {
      throw new Error('Signer not available')
    }
    return this.signer
  }

  async load() {
    this.#app.emit(AppEvent.Load)

    this.onLoad()
  }

  async signin() {
    if (!this.state.unverifiedWallet || !this.provider) {
      this.setProvider()
      return
    }

    const prev = this.localStorage?.getItem(NAME_KEY) as { token: string; wallet: string } | null | undefined
    if (prev && prev.token && prev.wallet.toLowerCase() === this.state.unverifiedWallet.toLowerCase()) {
      return this.onToken(prev.token, null, false)
    }

    this.message = this.generateMessage()

    if (this.signer) {
      // @see https://eth.wiki/json-rpc/API#eth_sign
      // @see https://docs.walletconnect.org/json-rpc-api-methods/ethereum#personal_sign
      const signature = await signMessage(this.provider, this.state.unverifiedWallet, this.message)
      if (!signature) {
        console.error('Signature could not be generated')
        this.#app.emit(AppEvent.ErrorLogin)
        // user refused to sign, do something about it.
        return
      }
      this.onSignature(signature)
    }
  }

  async onSignature(signature: string) {
    if (!this.provider) {
      console.warn('Provider missing')
    }

    // only used for metrics
    let providerName = 'Metamask'

    let chain = null
    if (signature == 'multisig') {
      chain = await this.getChainId()
    }

    const message = this.message
    const wallet = this.state.unverifiedWallet
    const options = {
      rememberSignIn: app.rememberSignIn,
      providerName,
      chain,
    }
    let f
    try {
      f = await fetch(`${process.env.API}/signin`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ wallet, message, signature, options }),
      })
    } catch (e) {
      // Very likely a network error
      this.#app.emit(AppEvent.ErrorLogin)
      console.error('Network Error, please try again a few minutes')
      return
    }

    const r = (await f.json()) as { success: boolean; name: string | null; token: string; isNewUser: boolean }

    if (r.success) {
      this.onToken(r.token, r.name, r.isNewUser)
    } else {
      this.#app.emit(AppEvent.ErrorLogin)
      console.error('Could not log in', r)
    }
  }

  onToken(key: string, name: string | null, isNewUser: boolean) {
    const payload = decodeJwt(key) as any
    if (!payload || typeof payload !== 'object') {
      console.error('Invalid JWT')
      this.localStorage?.removeItem(NAME_KEY)
      return
    }
    this.localStorage?.setItem(NAME_KEY, JSON.stringify({ token: key, wallet: payload.wallet }))
    const wallet = payload.wallet.toLowerCase()

    if (!name || !name?.length) {
      name = wallet.substring(0, 10) as string
    }

    this.setState({
      key,
      name,
      wallet: payload.wallet.toLowerCase(),
    })

    if (name) {
      this.localStorage?.setItem(NAME_KEY, name)
    }

    this.loadAvatar()

    // If it's a new user, send true
    this.#app.emit(AppEvent.Login, isNewUser)
  }

  async refreshProvider() {
    // Refresh the provider; This will re-request a signature or a QrCode if the user is not signed in via their provider.
    if (!this.provider) {
      await this.setProvider()
      return true
    } else {
      const accounts = await getUserAccounts(this.provider)
      if (!accounts) {
        return false
      }
      if (!this.provider) {
        return false
      }

      const prov = this.ethersWeb3Provider()
      this.signer = prov.getSigner() as any

      return true
    }
  }

  handleEvents = async () => {
    if (!this.provider) {
      return
    }
    this.provider.on('disconnect', () => {
      this.#app.emit(AppEvent.ProviderMessage, 'Web3 provider disconnected.')
    })
    this.provider.on('chainChanged', (chainId) => {
      this.#app.emit(AppEvent.ProviderMessage, 'Switched to chain to ' + chainId)

      console.info('Switched to chain ', chainId)
    })
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
    this.#app.emit(AppEvent.AvatarLoad)
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

  async switchNetwork(chainId: number, callback?: () => void) {
    if (!this.provider) {
      console.error('No provider or login selected')
      app.showSnackbar('No provider or login selected', PanelType.Danger)
      return
    }
    const current = await this.getChainId()
    if (chainId == current || chainId == 0) {
      if (callback) callback()
      return true
    }
    const r = await changeNetwork(this.provider, chainId)
    const { success, error } = r
    // new network is made so we have to generate a new signer.
    const newEthersJSProvider = this.ethersWeb3Provider()
    this.signer = newEthersJSProvider.getSigner() as any
    if (success) {
      !!callback && callback()
    } else {
      console.log(error)
    }
    return success
  }

  private async _initiate() {
    if (isNode()) {
      return
    }

    if (!document['addEventListener']) {
      return
    }

    const storedName = this.localStorage?.getItem(NAME_KEY)
    if (storedName) {
      this.setState({ name: storedName })
    }

    try {
      var jwtKey = Cookies.get('jwt')
    } catch (e) {
      console.log('Sandboxed iframe, no cookies')
    }

    if (jwtKey) {
      await this.setKey(jwtKey)
    } else {
      // clean name if we dont have a JWT
      this.setState({ name: undefined })
    }

    this.setProvider()
  }

  /**
   * Is ran after setProvider, method grabs the user accounts and grabs the etherJS signer.
   * @returns
   */
  private async setProvider() {
    this.provider = ssrFriendlyWindow?.ethereum as MetaMaskInpageProvider

    if (this.signedIn) {
      this.handleEvents()
      return
    }

    // Request accounts of the user.
    const accounts = await getUserAccounts(this.provider)
    if (!accounts || !accounts[0]) {
      //No account found
      this.#app.emit(AppEvent.ErrorLogin)
      return false
    }

    this.setState({
      unverifiedWallet: accounts[0],
    })
    this.handleEvents()

    // Create an ethersJS signer.
    this.setSigner()
    return true
  }

  /**
   * Method called after setSigner()
   * @returns
   */
  private onSetSigner() {
    this.load()
  }

  private generateMessage() {
    const d = new Date().toUTCString()
    // Add date to message but remove seconds as it would apparently cause wallets to not match.
    return `# Terms of Service

I agree to the terms of service (and any future revisions) detailed at:

  https://www.voxels.com/terms

I agree to follow the code of conduct detailed at

  https://www.voxels.com/conduct

  Date: ${d}`
  }

  async emailSignin(email: string, code: string) {
    localStorage.removeItem('cv-signature')

    let f

    try {
      f = await fetch(`${process.env.API}/signin`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ email, code }),
      })
    } catch (e) {
      this.#app.emit(AppEvent.ErrorLogin)

      // Very likely a network error
      console.error('Network Error, please try again a few minutes')

      return
    }

    const r = (await f.json()) as { success: boolean; name: string | null; token: string; isNewUser: boolean }

    if (r.success) {
      this.onToken(r.token, r.name, r.isNewUser)
    } else {
      this.#app.emit(AppEvent.ErrorLogin)
      console.error('Could not sign in')
    }
  }
}

export const login = new StateLogin(app)
export const provider = login

// // For debugging
// if (typeof window !== 'undefined') {
//   ;(window as any).login = login
// }
