import { EventEmitter } from 'events'
import { Animation } from './lib/animations'
import { Vector3, vec3 } from './lib/maths'
import { AnimationTarget, FeatureDescription } from './lib/types'
import Parcel from './parcel'

const throttle = (curried: Function, duration: number = 100, params: any) => curried
//indirect eval @see https://esbuild.github.io/content-types/#direct-eval
const eval2 = eval
/* @internal */
export class Feature extends EventEmitter {
  readonly parcel: Parcel
  private _content: FeatureDescription
  private _uuid: string
  private _type: string
  metadata: any

  private _position: Vector3 = Vector3.Zero()
  private _rotation: Vector3 = Vector3.Zero()
  private _scale: Vector3 = new Vector3(1, 1, 1)
  position: Vector3
  rotation: Vector3
  scale: Vector3

  static create: (parcel: Parcel, obj: FeatureDescription) => Feature
  onClick?: () => void

  get hasScript() {
    return !!this._content.script
  }

  toJSON() {
    return this._content
  }
  toString() {
    return `[Scripting Feature ${this._type} - ${this._uuid}]`
  }

  evalScript() {
    // Set feature locally then eval the script
    /**
     * Temporary hack to pass 'this' into eval'd script
     * We set a global temp object with the feature keyed by uuid
     * then pass that into the eval'd function
     * finally we delete the temp object
     * DO NOT DELETE;
     */
    if (!(globalThis as any).__tempFeatures) (globalThis as any).__tempFeatures = {}
    ;(globalThis as any).__tempFeatures[this._uuid] = this

    try {
      eval2(`
        ((feature) => {
        console.log('feature',feature)
        ${this._content.script}
        })(__tempFeatures['${this._uuid}']);
      `)
    } catch (error) {
      console.error(`[Scripting] Error evaluating script for feature ${this._uuid}:`, error)
    } finally {
      // Always clean up the temp feature reference, even if script evaluation fails
      delete (globalThis as any).__tempFeatures[this._uuid]
    }
  }

  constructor(parcel: Parcel, obj: FeatureDescription) {
    super()
    this.metadata = {}
    this.parcel = parcel
    this._type = obj.type
    this._uuid = obj.uuid
    this._content = obj
    const mutated = throttle(
      () => {
        const s = {
          position: this._content.position,
          rotation: this._content.rotation,
          scale: this._content.scale,
        }

        this._position.toArray(s.position as vec3)
        this._rotation.toArray(s.rotation as vec3)
        this._scale.toArray(s.scale as vec3) // console.log(`Mutated`)

        this.set(s)
      },
      10,
      {
        leading: false,
        trailing: true,
      },
    )
    const handler = (attr: any) => ({
      set(target: Record<string, unknown>, key: string, value: number) {
        if (typeof value !== 'number') {
          console.error(`[Scripting] ${key} is not a number`)
          return false
        }
        target[key] = value
        mutated()
        return true
      },
    })
    this._position = Vector3.FromArray((obj.position || [0, 0, 0]) as vec3)
    this.position = new Proxy(this._position, handler('position') as any)
    this._rotation = Vector3.FromArray((obj.rotation || [0, 0, 0]) as vec3)
    this.rotation = new Proxy(this._rotation, handler('rotation') as any)
    this._scale = Vector3.FromArray((obj.scale || [1, 1, 1]) as vec3)
    this.scale = new Proxy(this._scale, handler('scale') as any)
    this.updateVectors()
  }

  get uuid() {
    return this._uuid
  }

  get id() {
    return this._content.id
  }

  get type() {
    return this._type
  }

  get description() {
    return this._content
  }

  get url() {
    return this._content.url
  }

  set url(uri) {
    this.set({ url: uri })
  }

  get(key: string) {
    return this._content[key]
  }
  getSummary() {
    return `position: ${this.position.asArray()}; rotaton: ${this.rotation.asArray()};  scale: ${this.scale.asArray()};`
  }
  set(dict: Partial<FeatureDescription>) {
    Object.assign(this._content, dict)

    let keys = Array.from(Object.keys(dict)) || []

    if (keys.includes('position') || keys.includes('scale') || keys.includes('rotation')) {
      this.updateVectors()
    }

    this.save(dict)
  }

  private updateVectors() {
    this._position.set(this._content.position[0], this._content.position[1], this._content.position[2])
    this._rotation.set(this._content.rotation[0], this._content.rotation[1], this._content.rotation[2])
    this._scale.set(this._content.scale[0], this._content.scale[1], this._content.scale[2])
  }

  clone() {
    let d = JSON.parse(JSON.stringify(this.description))
    delete d.id
    delete d.uuid
    let c = this.parcel.createFeature(this.type, d, true)
    c.set(d)
    return c
  }

  save(dict: Partial<FeatureDescription>) {
    // console.log('Saving feature', dict)

    this.parcel.broadcast({
      type: 'update',
      uuid: this.uuid,
      content: dict as any,
    })
  }

  help() {
    console.log(`[Scripting] Visit https://wiki.cryptovoxels.com/features/${this.type} for scripting help on this feature`)
  }

  createAnimation(key: AnimationTarget) {
    return new Animation(`scripting/animation/${this.uuid}`, key, 30, Animation.ANIMATIONTYPE_VECTOR3)
  }

  startAnimations(animationArray: Animation[]) {
    const animations = animationArray.map((a) => {
      const animation = a.clone()

      animation.getKeys().unshift({
        frame: 0,
        value: this[animation.targetProperty as 'position' | 'scale' | 'rotation'].clone(),
      })

      return animation.serialize()
    })
    this.parcel.broadcast({
      type: 'animate',
      uuid: this.uuid,
      animations,
    })
  }

  remove() {
    this.parcel.removeFeature(this)
  }

  /**
   * Dispose of the feature and clean up all resources
   */
  dispose() {
    // Remove all event listeners
    this.removeAllListeners()

    // Clean up any temp feature references
    if ((globalThis as any).__tempFeatures && (globalThis as any).__tempFeatures[this._uuid]) {
      delete (globalThis as any).__tempFeatures[this._uuid]
    }

    // Clear references
    this.onClick = undefined
    this.metadata = {}
  }
}

class Audio extends Feature {
  isPlaying = false

  onClick = () => {
    if (this.isPlaying) {
      this.pause()
    } else {
      this.play()
    }
  }

  play() {
    this.isPlaying = true
    this.parcel.broadcast({
      type: 'play',
      uuid: this.uuid,
    })
  }

  pause() {
    this.isPlaying = false
    this.parcel.broadcast({
      type: 'pause',
      uuid: this.uuid,
    })
  }

  stop() {
    this.isPlaying = false
    this.parcel.broadcast({
      type: 'stop',
      uuid: this.uuid,
    })
  }
}
class NftImage extends Feature {
  constructor(parcel: Parcel, obj: FeatureDescription) {
    super(parcel, obj)
  }
  /* Thottled functions */
  // getNftData = throttle(
  //   (callback = null) => {
  //     this._getNftData(callback)
  //   },
  //   500,
  //   {
  //     leading: false,
  //     trailing: true,
  //   },
  // )

  /*
  private _getNftData(callback: Function | null = null, account_address: string | null = null) {
    if (!this.description.url) {
      return null
    }
    let contract = this.description.url.split('/')[4]
    let token = this.description.url.split('/')[5]
    const api_url = `https://img.cryptovoxels.com/node/opensea?contract=${contract}&token=${token}&force_update=1${account_address !== null ? `&account_address=${account_address}` : ''}`
    let promise
    if (typeof global == 'undefined' || !global.fetchJson) {
      // fetch doesn't work nicely on the grid. So we use 'fetchJson' when on scripthost, and fetch() when local
      promise = fetch(api_url).then((r) => r.json())
    } else {
      promise = fetchJson(api_url)
    }
    return promise
      .then((r) => {
        if (callback) {
          callback(r)
        } else {
          console.error('[Scripting] No callback given to "getNftData"')
        }
        return r
      })
      .catch((e) => console.error('[Scripting]', e))
  }
  */
}

class TextInput extends Feature {
  text: string
  constructor(parcel: Parcel, obj: FeatureDescription) {
    super(parcel, obj)
    this.text = obj.text as string
    this.on('changed', (e: { text: string }) => {
      this.text = e.text
    })
  }

  dispose() {
    super.dispose()
    this.text = ''
  }
}

class SliderInput extends Feature {
  value: number = 0.01
  constructor(parcel: Parcel, obj: FeatureDescription) {
    super(parcel, obj)
    this.on('changed', (e: { value: number }) => {
      this.value = e.value
    })
  }

  dispose() {
    super.dispose()
    this.value = 0.01
  }
}
class Video extends Feature {
  isPlaying = false

  onClick = () => {
    if (this.isPlaying) {
      this.pause()
    } else {
      this.play()
    }
  }

  play() {
    this.parcel.broadcast({
      type: 'play',
      uuid: this.uuid,
    })
  }

  pause() {
    this.parcel.broadcast({
      type: 'pause',
      uuid: this.uuid,
    })
  }

  stop() {
    this.parcel.broadcast({
      type: 'stop',
      uuid: this.uuid,
    })
  }
}

class Youtube extends Feature {
  isPlaying = false
  isPaused = false

  onClick = () => {
    if (this.isPlaying) {
      if (this.isPaused) {
        this.unpause()
      } else {
        this.pause()
      }
    } else {
      this.play()
    }
  }

  play() {
    this.isPlaying = true
    this.parcel.broadcast({
      type: 'play',
      uuid: this.uuid,
    })
  }

  pause() {
    this.isPaused = true
    this.parcel.broadcast({
      type: 'pause',
      uuid: this.uuid,
    })
  }

  unpause() {
    this.isPaused = false
    this.parcel.broadcast({
      type: 'unpause',
      uuid: this.uuid,
    })
  }

  stop() {
    this.isPlaying = false
    this.parcel.broadcast({
      type: 'stop',
      uuid: this.uuid,
    })
  }
}

class PoseBall extends Feature {
  constructor(parcel: Parcel, obj: FeatureDescription) {
    super(parcel, obj)
  }

  sit() {
    this.parcel.broadcast({
      type: 'sit',
      uuid: this.uuid,
    })
  }
}

Feature.create = (parcel: Parcel, obj: FeatureDescription) => {
  if (obj.type === 'audio') {
    return new Audio(parcel, obj)
  } else if (obj.type === 'video') {
    return new Video(parcel, obj)
  } else if (obj.type === 'youtube') {
    return new Youtube(parcel, obj)
  } else if (obj.type === 'text-input') {
    return new TextInput(parcel, obj)
  } else if (obj.type === 'slider-input') {
    return new SliderInput(parcel, obj)
  } else if (obj.type === 'nft-image') {
    return new NftImage(parcel, obj)
  } else if (obj.type === 'pose-ball') {
    return new PoseBall(parcel, obj)
  } else {
    return new Feature(parcel, obj)
  }
}
