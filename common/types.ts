// This file is used to export all
import * as t from 'io-ts'
import type * as costumes from './messages/costumes'

// Export costumes
export type Costume = costumes.Costume
export type CostumeAttachment = costumes.CostumeAttachment
export type BoneNames = costumes.BoneNames

export const ParcelMetaCodec = t.type({
  id: t.number,
  x1: t.number,
  y1: t.number,
  z1: t.number,
  x2: t.number,
  y2: t.number,
  z2: t.number,
})

export type ParcelMeta = t.TypeOf<typeof ParcelMetaCodec>
