import * as t from 'io-ts'
import { ParcelGeometry } from './parcel'

export const EventCategories = ['session', 'exhibition'] as const
export const EventCategory = t.union([t.literal('session'), t.literal('exhibition')])
export type EventCategory = t.TypeOf<typeof EventCategory>

export const Event = t.type({
  id: t.number,
  parcel_id: t.number,
  author: t.string,
  author_name: t.string,
  name: t.string,
  category: t.union([EventCategory, t.undefined]),
  description: t.string,
  color: t.string,
  parcel_name: t.string,
  parcel_owner: t.string,
  parcel_owner_name: t.string,
  parcel_address: t.string,
  parcel_description: t.string,
  geometry: t.union([ParcelGeometry, t.undefined]),
  coordinates: t.any,
  parcel_x1: t.number,
  parcel_x2: t.number,
  y1: t.number,
  y2: t.number,
  parcel_z1: t.number,
  parcel_z2: t.number,
  timezone: t.string,
  starts_at: t.string,
  expires_at: t.string,
})

export type Event = t.TypeOf<typeof Event>
