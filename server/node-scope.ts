import { nodeScope, hostsParcel } from '../common/node-scope.mjs'
export const coverage = nodeScope(process.env.NODE_MODE || 'full', process.env.NODE_PARCELS || '')
export function assertHostedParcel(parcel: number) {
  if (!hostsParcel(coverage, parcel)) throw Error('Parcel is not hosted by this node')
}
