import type { Motion } from './player-body'
export { WALK, RUN } from './player-body'
import { WALK, JUMP_SPEED, GRAVITY, EYE } from './player-body'

// Sweep past Babylon's contact clearance to recheck support without a fall/push-out cycle.
const GROUND_PROBE = 0.02

type Vec3 = { x: number; y: number; z: number }

/** Babylon's swept ellipsoid collision, with movement shared by desktop, touch and XR. */
export default class BabylonBody {
  position = BABYLON.Vector3.Zero()
  motion: Motion = { hz: 0, vy: 0, impact: 0 }
  noclip = false
  flying = true
  gravity = true
  speed = WALK
  private velocity = BABYLON.Vector3.Zero()
  private center = BABYLON.Vector3.Zero()
  private displacement = BABYLON.Vector3.Zero()
  private collider: BABYLON.Collider
  private id: number
  private grounded = false
  private secondJump = true
  private readonly radius = new BABYLON.Vector3(0.25, EYE / 2, 0.25)

  constructor(private scene: BABYLON.Scene) {
    this.collider = scene.collisionCoordinator.createCollider()
    this.collider._radius = this.radius
    this.id = scene.getUniqueId()
  }

  jump() {
    if (!this.grounded && !this.secondJump) return
    if (!this.grounded) this.secondJump = false
    this.grounded = false
    this.velocity.y = JUMP_SPEED
  }

  resetMotion() {
    this.velocity.setAll(0)
    this.grounded = false
    this.secondJump = true
    this.motion = { hz: 0, vy: 0, impact: 0 }
  }

  step(move: Vec3, elapsed: number, instant = false) {
    if (!Number.isFinite(elapsed) || elapsed <= 0 || this.scene.isDisposed) return
    const duration = Math.min(elapsed, 0.1)
    const steps = Math.ceil(duration * 60)
    const dt = duration / steps
    const startX = this.position.x
    const startZ = this.position.z
    this.motion.impact = 0
    for (let i = 0; i < steps; i++) {
      const blend = instant ? 1 : 1 - Math.exp(-10 * dt)
      this.velocity.x += (move.x * this.speed - this.velocity.x) * blend
      this.velocity.z += (move.z * this.speed - this.velocity.z) * blend
      if (this.flying || this.noclip || !this.gravity) this.velocity.y = 0
      else this.velocity.y += GRAVITY * dt
      this.displacement.set(this.velocity.x * dt, this.flying || this.noclip ? move.y * this.speed * dt : this.velocity.y * dt, this.velocity.z * dt)
      if (this.grounded && !this.flying && !this.noclip && this.gravity && this.velocity.y <= 0) {
        this.displacement.y = Math.min(this.displacement.y, -GROUND_PROBE)
      }
      if (this.noclip) {
        this.position.addInPlace(this.displacement)
        continue
      }
      this.center.copyFrom(this.position)
      this.center.y -= EYE / 2
      this.scene.collisionCoordinator.getNewPosition(
        this.center,
        this.displacement,
        this.collider,
        5,
        null,
        (_id, next) => {
          const dy = next.y - this.center.y
          const stopped = Math.abs(dy - this.displacement.y) > 0.0001
          this.grounded = !this.flying && this.gravity && this.displacement.y < 0 && stopped
          if (this.grounded) {
            this.secondJump = true
            this.motion.impact = Math.max(this.motion.impact, -this.velocity.y)
          }
          if (stopped) this.velocity.y = 0
          this.position.copyFrom(next)
          this.position.y += EYE / 2
        },
        this.id,
      )
    }
    this.motion.hz = Math.hypot(this.position.x - startX, this.position.z - startZ) / duration
    this.motion.vy = this.velocity.y
  }
}
