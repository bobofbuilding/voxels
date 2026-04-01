////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Types for /api/islands

import * as t from 'io-ts'
import { NullableStr } from './feature'

export const PointGeometry = t.type(
  {
    type: t.literal('Point'),
    crs: t.type({
      type: t.literal('name'),
      properties: t.type({
        name: t.string,
      }),
    }),
    coordinates: t.tuple([t.number, t.number]),
  },
  'PointGeometry',
)
export type PointGeometry = t.TypeOf<typeof PointGeometry>

export const PolygonGeometry = t.type(
  {
    type: t.literal('Polygon'),
    crs: t.type({
      type: t.literal('name'),
      properties: t.type({
        name: t.string,
      }),
    }),
    coordinates: t.array(t.array(t.tuple([t.number, t.number]))),
  },
  'PolygonGeometry',
)
export type PolygonGeometry = t.TypeOf<typeof PolygonGeometry>

export const MultiPolygonGeometry = t.type(
  {
    type: t.literal('MultiPolygon'),
    crs: t.type({
      type: t.literal('name'),
      properties: t.type({
        name: t.string,
      }),
    }),
    coordinates: t.array(t.array(t.array(t.tuple([t.number, t.number])))),
  },
  'MultiPolygonGeometry',
)

export type MultiPolygonGeometry = t.TypeOf<typeof MultiPolygonGeometry>

// currently all islands geometry are polygons,
// but if we need to support multi-polygons, change this to union type (and add checks where appropriate)
// same for holes/lakes etc

/**
 * island record by get-islands
 *
 *
 */
export const IslandRecord = t.type(
  {
    name: t.string,
    other_name: NullableStr,
    texture: t.string,
    position: PointGeometry,
    id: t.number,
    geometry: PolygonGeometry,
    holes_geometry_json: MultiPolygonGeometry,
    lakes_geometry_json: MultiPolygonGeometry,
  },
  'IslandRecord',
)
export type IslandRecord = t.TypeOf<typeof IslandRecord>
