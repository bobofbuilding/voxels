import { expect, test } from 'vitest'
import Parcel from '../../parcel'
import { isAdminWallet } from '../../permissions'

test('parcel content updates retain fields and remove legacy settings', () => {
  const parcel = new Parcel({ id: 42, content: { voxels: 'existing', features: [{ type: 'image' }] } })
  parcel.setContent({ features: [{ type: 'sign' }, { type: 'sign' }], settings: { legacy: true } })
  expect(parcel.content.voxels).toBe('existing')
  expect(parcel.content.settings).toBeUndefined()
  expect(parcel.getFeaturesByType('sign')).toHaveLength(2)
  expect(parcel.summary.features).toHaveLength(2)
})

test('only the configured wallet receives administrator privileges', () => {
  expect(isAdminWallet(process.env.OWNER_ADDRESS!.toUpperCase())).toBe(true)
  expect(isAdminWallet('0x2D891ED45C4C3EAB978513DF4B92a35Cf131d2e2')).toBe(false)
  expect(isAdminWallet(undefined)).toBe(false)
})
