import { beforeEach, expect, test } from 'vitest'
import Favorite from '../../favorite-parcel'
import db from '../../pg'

beforeEach(() => db.query('test/reset-favorites', 'TRUNCATE favorites RESTART IDENTITY'))

test('favorites use token_id in the current schema and match wallets case-insensitively', async () => {
  expect(await Favorite.loadFromWalletAndParcelId('0xAbC', 670)).toBeNull()
  const favorite = new Favorite({ wallet: '0xAbC', parcel_id: 670 })
  expect(await favorite.create()).toEqual({ success: true })
  const saved = await Favorite.loadFromWalletAndParcelId('0xABC', 670)
  expect(saved?.parcel_id).toBe(670)
  expect(saved?.wallet).toBe('0xabc')
  expect(await saved!.remove()).toEqual({ success: true })
  expect(await Favorite.loadFromWalletAndParcelId('0xabc', 670)).toBeNull()
})
