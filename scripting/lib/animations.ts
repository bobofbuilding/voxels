export class Animation {
  name: string
  targetProperty: string
  framePerSecond: number
  dataType: number
  loopMode: number
  keys: { frame: number; value: any }[] = []

  static ANIMATIONTYPE_VECTOR3 = 1

  constructor(name: string, property: string, framePerSecond: number, dataType: number, loopMode: number = 0) {
    this.name = name
    this.targetProperty = property
    this.framePerSecond = framePerSecond
    this.dataType = dataType
    this.loopMode = loopMode
  }

  setKeys(keys: { frame: number; value: any }[]) {
    this.keys = keys
  }

  clone(): Animation {
    let a = new Animation(this.name, this.targetProperty, this.framePerSecond, this.dataType, this.loopMode)
    a.keys = this.keys.slice().map((key) => Object.assign({}, key))
    return a
  }

  getKeys(): { frame: number; value: any }[] {
    return this.keys
  }

  serialize() {
    return {
      name: this.name,
      targetProperty: this.targetProperty,
      framePerSecond: this.framePerSecond,
      dataType: this.dataType,
      loopMode: this.loopMode,
      keys: this.keys,
    }
  }
}
