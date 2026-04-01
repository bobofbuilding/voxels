////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Types for /api/parcels and /grid/parcels messages

import * as t from 'io-ts'
import { FullParcelRecord, pickType, SimpleParcelRecord, SingleParcelRecord } from './parcel'

/**
 * /api/parcels/cached.json
 */
export const CachedParcelsMessage = t.type(
  {
    success: t.boolean,
    parcels: t.array(SimpleParcelRecord),
  },
  'CacheParcelsMessage',
)
export type CachedParcelsMessage = t.TypeOf<typeof CachedParcelsMessage>

/**
 * /grid/parcels/:id
 * /grid/parcels/:id/at/:hash
 */
export const ApiParcelMessage = t.type(
  {
    success: t.boolean,
    parcel: SingleParcelRecord,
  },
  'ApiParcelMessage',
)
export type ApiParcelMessage = t.TypeOf<typeof ApiParcelMessage>

/**
 * /api/parcels/:/revert
 */
export const ApiStatusResponse = t.type(
  {
    success: t.boolean,
    message: t.string,
  },
  'ApiStatusResponse',
)
export type ApiStatusResponse = t.TypeOf<typeof ApiStatusResponse>

/**
 * Parcel included in /api/parcels/map.json
 */
export const MapParcelRecord = pickType(FullParcelRecord, 'MapParcelRecord', ['id', 'address', 'name', 'parcel_users', 'geometry', 'owner', 'owner_name', 'x1', 'x2', 'label', 'y2', 'z1', 'z2', 'is_common', 'suburb', 'settings'])
export type MapParcelRecord = t.TypeOf<typeof MapParcelRecord>

/**
 * /api/parcels/map.json
 */
export const ApiParcelMapMessage = t.type(
  {
    success: t.boolean,
    parcels: t.array(MapParcelRecord),
  },
  'ApiParcelMapMessage',
)
export type ApiParcelMapMessage = t.TypeOf<typeof ApiParcelMapMessage>
