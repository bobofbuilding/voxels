import { afterEach, beforeEach, expect, test } from 'vitest'
import { Ocean } from '../../src/terrain/ocean'
import BabylonBody from '../../src/controls/utils/babylon-body'
import { EYE } from '../../src/controls/utils/player-body'

let engine: BABYLON.NullEngine
let scene: BABYLON.Scene
let surface: Ocean
beforeEach(() => {
  engine = new BABYLON.NullEngine()
  scene = new BABYLON.Scene(engine)
  scene.collisionsEnabled = true
  surface = new Ocean(48, scene)
})
afterEach(() => {
  surface.dispose()
  scene.dispose()
  engine.dispose()
})
function walkAt(x: number, z: number) {
  const body = new BabylonBody(scene)
  body.flying = false
  body.position.set(x, EYE + 4, z)
  for (let i = 0; i < 180; i++) body.step({ x: 0, y: 0, z: 0 }, 1 / 60, true)
  return body
}
function island() {
  return {
    id: 1,
    geometry: {
      coordinates: [
        [
          [0.1, 0.1],
          [0.1, 0.3],
          [0.3, 0.3],
          [0.3, 0.1],
          [0.1, 0.1],
        ],
      ],
    },
    lakes_geometry_json: { coordinates: [] },
  }
}
test('former open water is opaque blue grid ground that supports a player', () => {
  const tile = surface.createInstance(0, 0)
  tile.computeWorldMatrix(true)
  expect(walkAt(5, 5).position.y).toBeCloseTo(0.74 + EYE, 1)
  const mat = tile.material as BABYLON.GridMaterial
  expect(mat.opacity).toBe(1)
  expect(mat.mainColor.b).toBeLessThan(0.1)
  expect(mat.lineColor.b).toBeGreaterThan(0.9)
})
test('clipped coastlines remain solid while island basement space is left open', () => {
  surface.setIslands({ getIslandData: () => [island()] } as any)
  surface.onChunkLoaded({ gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 })
  for (const mesh of scene.meshes) mesh.computeWorldMatrix(true)
  expect(walkAt(5, 5).position.y).toBeCloseTo(0.74 + EYE, 1)
  const ray = new BABYLON.Ray(new BABYLON.Vector3(20, 5, 20), BABYLON.Vector3.Down(), 10)
  expect(scene.pickWithRay(ray, (m) => m.checkCollisions)?.hit).toBe(false)
  surface.onChunkUnloaded({ gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 })
  expect(scene.meshes.filter((m) => m.checkCollisions && m.isEnabled())).toHaveLength(0)
})

test('a tile spanning multiple islands preserves every land cutout and fills lakes', () => {
  const a = island()
  a.lakes_geometry_json.coordinates = [
    [
      [
        [0.15, 0.15],
        [0.2, 0.15],
        [0.2, 0.2],
        [0.15, 0.2],
        [0.15, 0.15],
      ],
    ],
  ] as any
  const b = {
    ...island(),
    id: 2,
    geometry: {
      coordinates: [
        [
          [0.35, 0.1],
          [0.35, 0.3],
          [0.4, 0.3],
          [0.4, 0.1],
          [0.35, 0.1],
        ],
      ],
    },
  }
  surface.setIslands({ getIslandData: () => [a, b] } as any)
  surface.onChunkLoaded({ gridX: 0, gridZ: 0, worldX: 0, worldZ: 0 })
  for (const mesh of scene.meshes) mesh.computeWorldMatrix(true)
  const hit = (x: number, z: number) => scene.pickWithRay(new BABYLON.Ray(new BABYLON.Vector3(x, 5, z), BABYLON.Vector3.Down(), 10), (m) => m.checkCollisions)?.hit
  expect(hit(25, 25)).toBe(false)
  expect(hit(37, 20)).toBe(false)
  expect(hit(17, 17)).toBe(true)
  expect(hit(33, 20)).toBe(true)
})
