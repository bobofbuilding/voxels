export type NodeScope = { mode: 'full' | 'partial'; parcels: number[] | null }
export function nodeScope(mode?: string, value?: unknown): NodeScope
export function hostsParcel(scope: NodeScope, parcel: number): boolean
export function intersectParcels(a: number[] | null, b: number[] | null): number[] | null
