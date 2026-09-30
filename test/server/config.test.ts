import { expect, test } from 'vitest'
import { readConfig } from '../../server/config'

const env = { OWNER_ADDRESS: '0x134561f705A9C2DDA470b2246D075Bf7A3c612d2', JWT_SECRET: 'unit-test-only-secret-with-more-than-32-characters' }

test('authentication config normalizes the owner and shares the signing key', () => {
  const config = readConfig(env)
  expect(config.ownerAddress).toBe(env.OWNER_ADDRESS.toLowerCase())
  expect(new TextDecoder().decode(config.jwtKey)).toBe(env.JWT_SECRET)
})

test('missing or weak signing secrets fail closed', () => {
  for (const JWT_SECRET of [undefined, '', 'secret', ' '.repeat(40)]) expect(() => readConfig({ ...env, JWT_SECRET })).toThrow('JWT_SECRET')
})

test('missing, invalid, and zero owner addresses fail closed', () => {
  for (const OWNER_ADDRESS of [undefined, '', 'wallet', '0x' + '0'.repeat(40)]) expect(() => readConfig({ ...env, OWNER_ADDRESS })).toThrow('OWNER_ADDRESS')
})
