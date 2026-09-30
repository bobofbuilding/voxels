import { requireSecret } from '../services/env'

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const ownerAddress = env.OWNER_ADDRESS?.trim().toLowerCase()
  if (!ownerAddress || !/^0x[0-9a-f]{40}$/.test(ownerAddress) || /^0x0{40}$/.test(ownerAddress)) {
    throw new Error('OWNER_ADDRESS must be a nonzero Ethereum wallet address')
  }
  const jwtSecret = requireSecret(env)
  return Object.freeze({ ownerAddress, jwtSecret, jwtKey: new TextEncoder().encode(jwtSecret) })
}

let config: ReturnType<typeof readConfig> | undefined

export function getConfig() {
  return (config ??= readConfig())
}
