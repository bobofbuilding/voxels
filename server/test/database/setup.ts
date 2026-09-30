import { afterAll } from 'vitest'
import * as babylon from 'babylonjs'
import db from '../../pg'

if (!process.env.DATABASE_URL || !/\/voxels_test_[a-f0-9]+(?:\?|$)/.test(process.env.DATABASE_URL)) {
  throw new Error('Use pnpm test:db so database tests run only in an isolated test database')
}
;(globalThis as any).BABYLON = babylon

afterAll(async () => {
  await db.drain()
})
