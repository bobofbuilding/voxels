import RAPIER from '@dimforge/rapier3d-compat'
import { VoxelSize } from '../../common/voxels/constants'

export type Vec3 = { x: number; y: number; z: number }

export const PLAYER_QUERY = (0x0008 << 16) | 0x0001

type Entry = {
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
}

let world: RAPIER.World | null = null
const entries = new Map<string, Entry>()
let accumulator = 0
const STEP = 1 / 60

export function physics(): RAPIER.World | null {
  return world
}

export async function initPhysics() {
  if (world) return
  await RAPIER.init()
  world = new RAPIER.World({ x: 0, y: -10.8, z: 0 })
}

export function stepPhysics(dtSec: number) {
  if (!world) return
  accumulator += Math.min(dtSec, 0.05)
  while (accumulator >= STEP) {
    world.step()
    accumulator -= STEP
  }
}

function addVoxelsKeyed(key: string, coords: Int32Array, origin: Vec3, cellSize: number) {
  if (!world) return
  removeCollider(key)
  if (coords.length < 3) return

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(origin.x, origin.y, origin.z))
  const desc = RAPIER.ColliderDesc.voxels(coords, { x: cellSize, y: cellSize, z: cellSize })
  const collider = world.createCollider(desc, body)
  entries.set(key, { body, collider })
}

export function addVoxels(key: string, coords: Int32Array, origin: Vec3) {
  addVoxelsKeyed(key, coords, origin, VoxelSize)
}

export function addCuboid(key: string, half: Vec3, center: Vec3) {
  if (!world) return
  removeCollider(key)
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z))
  const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
  const collider = world.createCollider(desc, body)
  entries.set(key, { body, collider })
}

export function removeCollider(key: string) {
  if (!world) return
  const e = entries.get(key)
  if (!e) return
  world.removeCollider(e.collider, true)
  world.removeRigidBody(e.body)
  entries.delete(key)
}
