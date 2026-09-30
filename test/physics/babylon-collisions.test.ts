import { beforeEach, afterEach, expect, test, vi } from 'vitest'
vi.hoisted(() => {
  ;(globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
})
vi.mock('../../src/mono-pool', () => ({ runCompute: vi.fn() }))
import BabylonBody from '../../src/controls/utils/babylon-body'
import { EYE } from '../../src/controls/utils/player-body'
import Cube from '../../src/features/cube'
import VoxModel from '../../src/features/vox-model'
import Parcel from '../../src/parcel'
import PlayerCamera from '../../src/controls/utils/player-camera'
import ParcelBudget from '../../src/parcel-budget'
let engine: BABYLON.NullEngine
let scene: BABYLON.Scene
let body: BabylonBody
const still = { x: 0, y: 0, z: 0 }
function advance(move = still, seconds = 1, fps = 60) {
  for (let i = 0; i < seconds * fps; i++) body.step(move, 1 / fps, true)
}
function box(name: string, position: BABYLON.Vector3, size = { width: 1, height: 4, depth: 4 }) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene)
  mesh.position.copyFrom(position)
  mesh.checkCollisions = true
  mesh.computeWorldMatrix(true)
  return mesh
}
function parcel() {
  const root = new BABYLON.TransformNode('parcel', scene)
  return { id: 1, owner: '', featuresList: [], featureRoot: root, transform: root, syncWorldBounds() {}, featureBounds: new BABYLON.BoundingBox(new BABYLON.Vector3(-100, -100, -100), new BABYLON.Vector3(100, 100, 100)) } as any
}
beforeEach(() => {
  engine = new BABYLON.NullEngine()
  scene = new BABYLON.Scene(engine)
  scene.collisionsEnabled = true
  body = new BabylonBody(scene)
  body.flying = false
  body.position.set(0, EYE + 3, 0)
  box('floor', new BABYLON.Vector3(0, -0.5, 0), { width: 100, height: 1, depth: 100 })
})
afterEach(() => {
  scene.dispose()
  engine.dispose()
})
test('lands on blocks and remains standing without sinking', () => {
  advance(still, 3)
  expect(body.position.y).toBeCloseTo(EYE, 1)
  advance(still, 5)
  expect(body.position.y).toBeCloseTo(EYE, 1)
})
test('sweeps against walls at low frame rates and slides along them', () => {
  box('voxel wall', new BABYLON.Vector3(2, 2, 0))
  advance(still, 3)
  advance({ x: 1, y: 0, z: 0 }, 2, 10)
  expect(body.position.x).toBeLessThan(1.3)
  expect(body.position.x).toBeGreaterThan(1)
  const z = body.position.z
  advance({ x: 1, y: 0, z: 1 }, 0.5)
  expect(body.position.z).toBeGreaterThan(z + 0.5)
})
test('jumping hits ceilings and flying still respects solid cubes', () => {
  advance(still, 3)
  box('ceiling', new BABYLON.Vector3(0, 3, 0), { width: 10, height: 0.2, depth: 10 })
  body.jump()
  advance(still, 0.2)
  expect(body.position.y).toBeGreaterThan(EYE)
  expect(body.position.y).toBeLessThan(2.92)
  body.flying = true
  advance({ x: 0, y: 1, z: 0 }, 2)
  expect(body.position.y).toBeLessThan(2.92)
})
test('disposed geometry stops blocking movement', () => {
  const wall = box('temporary', new BABYLON.Vector3(2, 2, 0))
  advance(still, 3)
  advance({ x: 1, y: 0, z: 0 }, 1)
  expect(body.position.x).toBeLessThan(1.3)
  wall.dispose()
  advance({ x: 1, y: 0, z: 0 }, 1)
  expect(body.position.x).toBeGreaterThan(3)
})
test('cubes are placeable and solid even when saved collision flags are off', async () => {
  const p = parcel()
  expect(ParcelBudget.budget('cube', p)).toBeGreaterThan(0)
  const cube = new Cube(scene, p, 'cube', { type: 'cube', position: [2, 2, 0], rotation: [0, 0, 0], scale: [1, 4, 4] } as any)
  await cube.generate()
  expect(cube.mesh!.checkCollisions).toBe(true)
  advance(still, 3)
  advance({ x: 1, y: 0, z: 0 }, 1)
  expect(body.position.x).toBeLessThan(1.3)
  cube.description.collidable = false
  cube.afterSetCommon()
  advance({ x: 1, y: 0, z: 0 }, 1)
  expect(body.position.x).toBeLessThan(1.3)
})
test('loaded voxel models and their transformed instances collide', async () => {
  const p = parcel()
  const model = new VoxModel(scene, p, 'model', { type: 'vox-model', position: [2, 2, 0], rotation: [0, Math.PI / 4, 0], scale: [1, 4, 4] } as any)
  ;(model as any).applyImportedMesh(BABYLON.MeshBuilder.CreateBox('imported vox', {}, scene))
  expect(model.mesh!.checkCollisions).toBe(true)
  advance(still, 3)
  advance({ x: 1, y: 0, z: 0 }, 1)
  expect(body.position.x).toBeLessThan(2.5)
  expect(Math.abs(body.position.z)).toBeGreaterThan(0.1)
  const instance = new VoxModel(scene, p, 'instance', { type: 'vox-model', position: [-3, 2, 0], rotation: [0, 0, 0], scale: [1, 4, 4] } as any)
  await instance.generateInstance(model)
  expect(instance.mesh!.checkCollisions).toBe(true)
  body.position.set(-6, EYE + 0.02, 0)
  body.resetMotion()
  advance({ x: 1, y: 0, z: 0 }, 1)
  expect(body.position.x).toBeLessThan(-3.7)
})

for (const method of ['setVoxelMesh', 'setGlassMesh']) {
  test(`${method} attaches collidable parcel blocks`, () => {
    const p = Object.assign(Object.create(Parcel.prototype), { transform: new BABYLON.TransformNode('parcel-blocks', scene), x1: 0, x2: 2, z1: 0, z2: 2 })
    p.transform.position.set(3, 3, 1)
    const mesh = BABYLON.MeshBuilder.CreateBox('blocks', { width: 1, height: 4, depth: 4 }, scene)
    p[method](mesh, { pickable: true })
    expect(mesh.checkCollisions).toBe(true)
    advance(still, 3)
    advance({ x: 1, y: 0, z: 0 }, 1)
    expect(body.position.x).toBeLessThan(1.4)
  })
}
test('third-person camera stops before collidable geometry', () => {
  body.position.set(0, EYE, 0)
  box('behind', new BABYLON.Vector3(0, 2, -2), { width: 5, height: 4, depth: 1 })
  const camera = new PlayerCamera('third-person', BABYLON.Vector3.Zero(), scene)
  camera.body = body
  camera.distance = 5
  camera.place()
  expect(camera.position.z).toBeGreaterThan(-1.5)
  expect(camera.position.z).toBeLessThan(-0.9)
})
test('a moved cube instance updates its collision surface', async () => {
  const p = parcel()
  const cube = new Cube(scene, p, 'original', { type: 'cube', position: [-5, 2, 0], rotation: [0, 0, 0], scale: [1, 4, 4] } as any)
  await cube.generate()
  const instance = new Cube(scene, p, 'copy', { type: 'cube', position: [2, 2, 0], rotation: [0, 0, 0], scale: [1, 4, 4] } as any)
  await instance.generateInstance(cube)
  advance(still, 3)
  advance({ x: 1, y: 0, z: 0 }, 1)
  expect(body.position.x).toBeLessThan(1.3)
  instance.description.position = [7, 2, 0]
  ;(instance as any).setCommon()
  advance({ x: 1, y: 0, z: 0 }, 1)
  expect(body.position.x).toBeGreaterThan(3)
})
