import { getConfig } from './config'

// One configured wallet owns the deployment and its administrator privileges.
export function isAdminWallet(wallet: string | null | undefined): boolean {
  const owner = getConfig().ownerAddress
  return !!owner && !!wallet && wallet.toLowerCase() === owner
}
