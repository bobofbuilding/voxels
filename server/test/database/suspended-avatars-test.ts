import { beforeEach, expect, test } from 'vitest'
import Avatar from '../../avatar'
import db from '../../pg'

beforeEach(() => db.query('test/reset-bans', 'TRUNCATE banned_users RESTART IDENTITY'))

test('suspension expiry and revocation use database time', async () => {
  expect(await Avatar.getSuspended('0xabc')).toBeNull()
  await Avatar.suspend('0xabc', 'test', 7)
  const saved = await Avatar.getSuspended('0xABC')
  expect(saved?.reason).toBe('test')
  expect(saved?.expires_at.getTime()).toBeGreaterThan(Date.now() + 6 * 86400000)
  expect(saved?.expires_at.getTime()).toBeLessThan(Date.now() + 8 * 86400000)
  expect(await Avatar.unsuspend('0xABC')).not.toBeNull()
  expect(await Avatar.getSuspended('0xabc')).toBeNull()
})
