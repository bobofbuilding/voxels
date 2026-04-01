import { Feature3D } from './feature'
import { Advanced, Animation, FeatureEditor, FeatureEditorProps, Toolbar, UuidReadOnly } from '../ui/features'
import Panel, { PanelType } from '../../web/src/components/panel'
import ActionGui from '../ui/gui/action-button-gui'
import { app, AppEvent } from '../../web/src/state'
import { PoapDispenserRecord } from '../../common/messages/feature'
import { checkWalletOwnsPOAP } from '../../common/helpers/apis'
import { FeatureMetadata, FeatureTemplate } from './_metadata'
import { Position, Rotation, Scale } from '../../web/src/components/editor'

const params = {
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  credentials: 'include',
} as Record<string, Record<string, string> | string>

//
// Set up:
// 1. People have to create their own poaps through the poap website.
// 2a. They provide us the poap edit code and event id &
// 2b. We encrypt the edit code & store it all in the feature description.
// Redeeming:
// 3a. We check if a visitor already has the poap and if not...
// 3b. We pass the user supplied credentials to the server
// Server:
// Note: We query the poap api 3 times. Both times we use a private poap api key to make the queries.
// 4a. The server's first query retrieves a list of all the the poap redeemable mint codes for the event
// 4d. The next query will use the list and redeem one.
//
export default class PoapDispenser extends Feature3D<PoapDispenserRecord> {
  static redeemPoapSound: BABYLON.Sound | null = null
  static metadata: FeatureMetadata = {
    title: 'POAP dispenser',
    subtitle: 'Distribute event POAP tokens',
    type: 'poap-dispenser',
    image: '/icons/poap.png',
  }
  static template: FeatureTemplate = {
    type: 'poap-dispenser',
    scale: [1, 1, 1],
  }
  ActionGui: ActionGui | null = null
  hasClaimed = false
  redeeming = false

  whatIsThis() {
    return <label>This feature will dispense user-created POAPs for time-sensitive events.</label>
  }

  shouldBeInteractive() {
    return !this.hasUserRedeemed || this.parcel.canEdit
  }

  async onClick(): Promise<boolean> {
    if (!app.signedIn) {
      app.showSnackbar('You must be signed in to claim this!', PanelType.Danger)
      return false
    }
    if (this.redeeming) {
      app.showSnackbar('You already queried to redeem this POAP.', PanelType.Danger)
      return false
    }
    if (await this.hasUserRedeemed()) {
      app.showSnackbar('You have already redeemed this POAP!', PanelType.Danger)
      return false
    }

    // Localstorage check
    const redeemedPoaps = JSON.parse(localStorage.getItem('cv-poap') || '[]')
    const compositeKey = `id-${this.parcel.id || this.parcel.spaceId}-uuid-${this.description.uuid}`
    if (redeemedPoaps.includes(compositeKey)) {
      app.showSnackbar('Error claiming POAP.', PanelType.Danger)
      return false
    }
    app.showSnackbar('Requesting Poap...', PanelType.Warning)

    this.redeeming = true
    const body = {
      wallet: app.state.wallet,
      code: this.description.edit_code,
      event_id: this.description.event_id,
    }
    let p, r
    try {
      p = await fetch(`/api/poap/redeem`, {
        ...params,
        method: 'post',
        body: JSON.stringify(body),
      })
      r = await p.json()
    } catch {
      this.redeeming = false
      app.showSnackbar('Error requesting POAP.', PanelType.Danger)
      return false
    }
    this.redeeming = false
    if (r && r.success) {
      this.hideGui()
      app.showSnackbar('Congratulation!', PanelType.Success)
      this.avatar?.emote('🌟', this.positionInGrid.subtract(new BABYLON.Vector3(0, 1, 0)))
      if (PoapDispenser.redeemPoapSound) {
        PoapDispenser.redeemPoapSound.setPosition(this.absolutePosition)
        PoapDispenser.redeemPoapSound.play()
      }

      // LocalStorage - Add Poap to redeemd list
      const compositeKey = 'id-' + (this.parcel.id || this.parcel.spaceId) + '-uuid-' + (this.description.uuid as string)
      let redeemedPoaps = JSON.parse(localStorage.getItem('cv-poap') || '[]')
      redeemedPoaps = redeemedPoaps.slice(-100)
      redeemedPoaps.push(compositeKey)
      localStorage.setItem('cv-poap', JSON.stringify(redeemedPoaps))

      this.showGui()
    } else {
      // what to do if successs if false
      app.showSnackbar(r.error || 'Could not redeem', PanelType.Danger)

      return false
    }

    return true
  }

  onUserLogin = () => {
    this.hideGui()
    this.showGui()
  }

  async showGui() {
    if (this.ActionGui) return
    if (!this.description.edit_code || !this.description.event_id) {
      return
    }
    const nudge = this.mesh ? new BABYLON.Vector3(0, this.mesh.scaling.y, 0) : BABYLON.Vector3.Zero()
    this.ActionGui = new ActionGui(this, { position: nudge })
    const styling = { height: '50px', fontSizePx: '18px' }
    if (!app.signedIn) {
      this.ActionGui.addText('Login to Redeem', styling)
      app.on(AppEvent.Login, this.onUserLogin)
    } else if (this.parcel.canEdit || !(await this.hasUserRedeemed())) {
      this.ActionGui.addButton('Click to Redeem POAP', { onClick: () => this.onClick(), ...styling })
    } else {
      this.ActionGui.addText('Thank you!', styling)
    }
    this.ActionGui.generate()
  }

  async hasUserRedeemed() {
    if (!app.signedIn) {
      return false
    }
    if (!this.description.event_id || this.description.event_id?.length == 0) {
      return false
    }
    if (this.hasClaimed) {
      return true
    }
    if (app.state.wallet) {
      this.hasClaimed = await checkWalletOwnsPOAP(this.description.event_id, app.state.wallet)
    }
    return this.hasClaimed
  }

  onTrigger = () => {
    this.showGui()
  }

  async generate() {
    if (!this.description.animation) {
      // set a default rotating animation if no animations set by user
      this.description.animation = {
        destination: 'rotation',
        keyframes: [
          { frame: 0, value: [0, 0, 0] },
          { frame: 120, value: [0, 3.14, 0] },
          { frame: 360, value: [0, 3.14 * 2, 0] },
        ],
        easing: {},
      }
    }

    this.mesh = await this.scene.importVox(process.env.ASSET_PATH + '/models/poap.vox', { signal: this.abortController.signal })
    this.mesh.isPickable = true
    this.mesh.name = this.uniqueEntityName('mesh')
    this.mesh.id = this.mesh.name

    this.setCommon()

    this.addEvents()
    this.addTrigger({ onTrigger: this.onTrigger, onUnTrigger: this.onUnTrigger, proximityToTrigger: 3.5 })
    this.addAnimation()
    if (!PoapDispenser.redeemPoapSound && this.audio) {
      PoapDispenser.redeemPoapSound = this.audio.createSound({
        name: 'redeem-poap-sound',
        url: `${process.env.SOUNDS_URL}/alerts/sign-guestbook.mp3`,
        options: { loop: false, autoplay: false },
      })
    }
  }

  onUnTrigger = () => {
    this.hideGui()
  }

  hideGui() {
    if (this.ActionGui) {
      this.ActionGui.dispose()
      this.ActionGui = null
    }
    app.removeListener(AppEvent.Login, this.onUserLogin)
  }

  dispose() {
    if (this.ActionGui) {
      this.ActionGui.dispose()
      this.ActionGui = null
    }

    // Remove localStorage of poap being redeemed if it exists.
    const compositeKey = 'id-' + (this.parcel.id || this.parcel.spaceId) + '-uuid-' + (this.description.uuid as string)
    let redeemedPoaps = JSON.parse(localStorage.getItem('cv-poap') || '[]')
    redeemedPoaps = redeemedPoaps.filter((poap: string) => poap == compositeKey)
    localStorage.setItem('cv-poap', JSON.stringify(redeemedPoaps))

    this._dispose()
  }

  afterSetCommon = () => {
    this.hideGui()
    this.showGui()
  }

  toString() {
    return `[Achievement]`
  }
}

class Editor extends FeatureEditor<PoapDispenser> {
  constructor(props: FeatureEditorProps<PoapDispenser>) {
    super(props)

    this.state = {
      id: props.feature.description.id,
      event_id: props.feature.description.event_id,
      edit_code: props.feature.description.edit_code,
      // for UX purposes
      code: props.feature.description.edit_code,
      loading: false,
    }
  }

  componentDidUpdate(prevProps: FeatureEditorProps<PoapDispenser>, prevState: any) {
    this.merge({
      event_id: this.state.event_id,
    })

    if (prevState.edit_code != this.state.edit_code) {
      this.merge({ edit_code: this.state.edit_code })
    }
  }

  onSetPoapCode = async () => {
    if (!this.state.code) {
      this.setState({ edit_code: null })
      return
    }
    this.setState({ loading: true })
    const body = { code: this.state.code }
    // on set POAP code, encrypt it.
    let r: { success: boolean; encrypted?: string }
    try {
      const p = await fetch(`/api/poap/encrypt`, { method: 'POST', ...params, body: JSON.stringify(body) })
      r = await p.json()
    } catch {
      console.log('could not encrypt your code')
      this.setState({ loading: false })
      return
    }

    if (r && r.encrypted) {
      this.setState({ edit_code: r.encrypted, code: r.encrypted }, () => {
        this.merge({ edit_code: r.encrypted })
      })
    }
    this.setState({ loading: false })
  }

  render() {
    return (
      <section>
        <header>
          <h2>Edit Achievement</h2>
          <button onClick={this.onBackClick} class="close">
            <span>&times;</span>
          </button>
        </header>
        <div className="scrollContainer">
          <Toolbar feature={this.props.feature} scene={this.props.scene} />
          {/* keys are provided so that the getState in the component is reset after gizmo is used */}
          <Position feature={this.props.feature} key={this.props.feature.position.toString()} />
          <Scale feature={this.props.feature} key={this.props.feature.scale.toString()} />
          <Rotation feature={this.props.feature} key={this.props.feature.rotation.toString()} />
          {this.state.error && <Panel type="warning">{this.state.error}</Panel>}
          <Advanced>
            <div className="f">
              <label>Event ID</label>
              <input value={this.state.event_id} onInput={(e) => this.setState({ event_id: e.currentTarget.value })} type="text" />
              <small>As seen on the POAP's event page.</small>
            </div>

            <div className="f">
              <label>POAP Edit Code</label>
              <input value={this.state.code} disabled={this.state.loading || !!this.state.edit_code} onChange={(e) => this.setState({ code: e.currentTarget.value })} type="text" />
              <small>Secret code provided to the creator of the poap.</small>
              {!this.state.edit_code ? (
                <button onClick={this.onSetPoapCode} disabled={this.state.loading}>
                  Save and encrypt
                </button>
              ) : (
                <button onClick={() => this.setState({ code: '', edit_code: null })} disabled={this.state.loading}>
                  Reset
                </button>
              )}
            </div>
            <Animation feature={this.props.feature} />
            <UuidReadOnly feature={this.props.feature} />
          </Advanced>
        </div>
      </section>
    )
  }
}

PoapDispenser.Editor = Editor
