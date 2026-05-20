import * as t from 'io-ts'

export type BoneNames =
  | 'hips'
  | 'spine'
  | 'spine1'
  | 'spine2'
  | 'neck'
  | 'head'
  | 'headtop_end'
  | 'leftshoulder'
  | 'leftarm'
  | 'leftforearm'
  | 'lefthand'
  | 'lefthandindex1'
  | 'lefthandindex2'
  | 'lefthandindex3'
  | 'lefthandindex4'
  | 'rightshoulder'
  | 'rightarm'
  | 'rightforearm'
  | 'righthand'
  | 'righthandindex1'
  | 'righthandindex2'
  | 'righthandindex3'
  | 'righthandindex4'
  | 'leftupleg'
  | 'leftleg'
  | 'leftfoot'
  | 'lefttoebase'
  | 'lefttoe_end'
  | 'rightupleg'
  | 'rightleg'
  | 'rightfoot'
  | 'righttoebase'
  | 'righttoe_end'

export const BoneNames: BoneNames[] = [
  'hips',
  'spine',
  'spine1',
  'spine2',
  'neck',
  'head',
  'headtop_end',
  'leftshoulder',
  'leftarm',
  'leftforearm',
  'lefthand',
  'lefthandindex1',
  'lefthandindex2',
  'lefthandindex3',
  'lefthandindex4',
  'rightshoulder',
  'rightarm',
  'rightforearm',
  'righthand',
  'righthandindex1',
  'righthandindex2',
  'righthandindex3',
  'righthandindex4',
  'leftupleg',
  'leftleg',
  'leftfoot',
  'lefttoebase',
  'lefttoe_end',
  'rightupleg',
  'rightleg',
  'rightfoot',
  'righttoebase',
  'righttoe_end',
]

export const CostumeAttachment = t.intersection(
  [
    t.type({
      bone: t.string,
      wid: t.string,
      position: t.array(t.number),
      rotation: t.array(t.number),
      scaling: t.array(t.number),
    }),
    t.partial({
      wearable: t.type({ id: t.string, name: t.string }),
    }),
  ],
  'CostumeAttachment',
)

export type CostumeAttachment = t.TypeOf<typeof CostumeAttachment>

export const Costume = t.type(
  {
    id: t.number,
    default_color: t.union([t.undefined, t.string]),
    skin: t.string,
    name: t.string,
    attachments: t.union([t.array(CostumeAttachment), t.null]),
    wallet: t.union([t.undefined, t.string]),
  },
  'Costume',
)
export type Costume = t.TypeOf<typeof Costume>
