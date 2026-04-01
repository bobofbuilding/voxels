import { Component, createRef } from 'preact'
import { setupScene } from '../../../web/src/helpers/scenes'
import Avatar from './avatar'
import { Wearable } from './wearable'
import { ApiAvatar } from '../../../common/messages/api-avatars'
import { CostumeAttachment } from '../../../common/messages/costumes'

const fetchParams = {
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  credentials: 'include',
} as const

export type AvatarFrame = 'profile' | 'hero' | 'parcel' | 'space' | null

export interface Props {
  wallet: string
  avatar?: ApiAvatar
  dance?: string
  frame?: AvatarFrame
}

export interface State {
  wallet: string
  avatar?: ApiAvatar
  renderReady: boolean
  dance: string
}

const animationsList = ['Idle', 'Walk', 'Dance', 'Run', 'Floating', 'Sitting', 'Spin', 'Savage', 'Uprock', 'Floss', 'Backflip', 'Celebration', 'Orange', 'Hype', 'Shocked', 'Wipe', 'Applause', 'Jump']

export default class AvatarCanvas extends Component<Props, State> {
  private engine: BABYLON.Engine | null = null
  private scene: BABYLON.Scene | null = null
  private canvas = createRef()

  constructor(props: Props) {
    super(props)
    this.state = { wallet: props.wallet ? props.wallet : '', avatar: props.avatar, renderReady: false, dance: props.dance || 'Idle' }
  }

  private get costume() {
    return this.props.avatar?.costume || this.state.avatar?.costume
  }

  componentDidMount() {
    this.engine = new BABYLON.Engine(this.canvas.current, true, { stencil: true })
    this.scene = setupScene(this.canvas.current, this.engine, () => {
      /* do nothing onClick */
    })
    this.scene.autoClear = false

    if (this.props.frame === 'profile') {
      const camera = this.scene.activeCamera as BABYLON.ArcRotateCamera
      camera.radius = 3
      camera.alpha = Math.PI
    }

    window.addEventListener(
      'resize',
      () => {
        this.engine?.resize()
      },
      { passive: true },
    )

    const background = new BABYLON.Scene(this.engine)
    background.createDefaultCamera()

    const pp = new BABYLON.PostProcess(
      '', // name
      'Wobble', // shader name
      ['iTime'], // uniforms
      [], // samplers
      1.0, // ratio
      background.activeCamera,
    )

    const start = performance.now()
    pp.onApply = (effect) => {
      const time = (performance.now() - start) * 0.001
      effect.setFloat('iTime', time)
    }

    this.engine.runRenderLoop(() => {
      background.render()
      this.scene?.render()
    })

    this.fetch()
      .then(() => this.setState({ renderReady: true }))
      .catch(console.error)
  }

  async fetch() {
    // no fetch needed, parent provided the avatar via props
    if (this.props.avatar) return
    if (!this.props.wallet) return

    const r = await fetch(`/api/avatars/${this.props.wallet}.json`, fetchParams)
    const { avatar } = await r.json()
    this.setState({ avatar })
  }

  render() {
    let wearables = []

    if (this.scene && this.costume?.attachments) {
      wearables = this.costume.attachments.map((attachment: CostumeAttachment) => {
        return <Wearable key={`${this.costume.id}-${attachment.uuid}-${this.state.dance}`} scene={this.scene} attachment={attachment} selected={false} />
      })
    }

    const avatar = this.scene && (
      <Avatar key={`${this.costume?.id}-${this.state.dance}`} scene={this.scene} costume={this.costume} dance={this.state.dance}>
        {wearables}
      </Avatar>
    )

    return (
      <div>
        <canvas ref={this.canvas} onWheel={(ev: WheelEvent) => ev.preventDefault()} />

        {avatar}

        <div>
          <label>Dance:&nbsp;</label>
          <select onChange={(e) => this.setState({ dance: String(e.currentTarget?.value) })}>
            {animationsList.map((name) => {
              return (
                <option key={name} value={name} selected={name === this.state.dance}>
                  {name}
                </option>
              )
            })}
          </select>
        </div>
      </div>
    )
  }
}
