import { afterEach, expect, test, vi } from 'vitest'
vi.mock('../../server/avatar', () => ({ default: { getSuspended: vi.fn(async () => false) } }))
vi.mock('../../server/parcel-user-right', () => ({ default: { loadRoleFromParcelIdAndWallet: vi.fn(async () => null) } }))
vi.mock('../../server/parcel', () => ({ default: { load: vi.fn() } }))
vi.mock('../../server/pg', () => ({ default: { query: vi.fn(async () => ({ rows: [] })) } }))
vi.mock('../../server/permissions', () => ({ isAdminWallet: (wallet: string) => wallet?.toLowerCase() === '0x134561f705a9c2dda470b2246d075bf7a3c612d2' }))
import authParcel, { authFeature } from '../../server/auth-parcel'
const owner = '0x1111111111111111111111111111111111111111'
const parcel = { id: 1, owner, sandbox: true } as any
afterEach(() => vi.unstubAllEnvs())
test('admin launch policy blocks snapshot owners, moderators and anonymous sandbox edits', async () => {
  vi.stubEnv('PARCEL_EDIT_POLICY', 'admin')
  for (const user of [null, { wallet: owner }, { wallet: owner, moderator: true }]) {
    expect(await authParcel(parcel, user as any)).toBe(false)
    expect(await authFeature(1, 'feature', 1, user as any)).toBe(false)
  }
})
test('configured administrator can edit during the launch policy', async () => {
  vi.stubEnv('PARCEL_EDIT_POLICY', 'admin')
  expect(await authParcel(parcel, { wallet: '0x134561f705A9C2DDA470b2246D075Bf7A3c612d2' } as any)).toBe('Owner')
})
test('without launch policy existing sandbox behavior is preserved', async () => {
  vi.stubEnv('PARCEL_EDIT_POLICY', '')
  expect(await authParcel(parcel, null)).toBe('Sandbox')
})
