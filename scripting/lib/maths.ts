export type vec3 = [number, number, number]

export class Vector3 {
  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {}

  static FromArray(arr: vec3): Vector3 {
    return new Vector3(arr[0], arr[1], arr[2])
  }

  add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z)
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z)
  }

  subtract(v: Vector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z)
  }

  static Zero(): Vector3 {
    return new Vector3(0, 0, 0)
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }

  normalize(): Vector3 {
    const len = this.length()
    return len === 0 ? Vector3.Zero() : new Vector3(this.x / len, this.y / len, this.z / len)
  }

  set(x: number, y: number, z: number) {
    this.x = x
    this.y = y
    this.z = z
  }

  toArray(arr: vec3) {
    arr[0] = this.x
    arr[1] = this.y
    arr[2] = this.z
    // return [this.x, this.y, this.z]
  }

  asArray(): vec3 {
    return [this.x, this.y, this.z]
  }
}

export class Vector2 {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

export class Quaternion {
  constructor(
    public x: number,
    public y: number,
    public z: number,
    public w: number,
  ) {}

  multiply(q: Quaternion): Quaternion {
    const ax = this.x,
      ay = this.y,
      az = this.z,
      aw = this.w
    const bx = q.x,
      by = q.y,
      bz = q.z,
      bw = q.w
    return new Quaternion(aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)
  }

  static FromEulerAngles(x: number, y: number, z: number): Quaternion {
    const cx = Math.cos(x / 2),
      sx = Math.sin(x / 2)
    const cy = Math.cos(y / 2),
      sy = Math.sin(y / 2)
    const cz = Math.cos(z / 2),
      sz = Math.sin(z / 2)
    return new Quaternion(sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz)
  }

  static FromEulerVector(v: Vector3): Quaternion {
    return Quaternion.FromEulerAngles(v.x, v.y, v.z)
  }
}

export class Color3 {
  constructor(
    public r: number,
    public g: number,
    public b: number,
  ) {}

  static FromHexString(hex: string): Color3 {
    const parsed = parseInt(hex.replace('#', ''), 16)
    return new Color3(((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255)
  }

  toHexString(): string {
    const r = Math.round(this.r * 255)
      .toString(16)
      .padStart(2, '0')
    const g = Math.round(this.g * 255)
      .toString(16)
      .padStart(2, '0')
    const b = Math.round(this.b * 255)
      .toString(16)
      .padStart(2, '0')
    return `#${r}${g}${b}`
  }
}

export class Matrix {
  // minimal stub
  static Identity(): Matrix {
    return new Matrix()
  }
}
