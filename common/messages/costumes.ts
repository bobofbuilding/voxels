import * as t from 'io-ts'

export type BoneNames =
  | 'Hips'
  | 'Spine'
  | 'Spine1'
  | 'Spine2'
  | 'Neck'
  | 'Head'
  | 'HeadTop_End'
  | 'LeftShoulder'
  | 'LeftArm'
  | 'LeftForeArm'
  | 'LeftHand'
  | 'LeftHandIndex1'
  | 'LeftHandIndex2'
  | 'LeftHandIndex3'
  | 'LeftHandIndex4'
  | 'RightShoulder'
  | 'RightArm'
  | 'RightForeArm'
  | 'RightHand'
  | 'RightHandIndex1'
  | 'RightHandIndex2'
  | 'RightHandIndex3'
  | 'RightHandIndex4'
  | 'LeftUpLeg'
  | 'LeftLeg'
  | 'LeftFoot'
  | 'LeftToeBase'
  | 'LeftToe_End'
  | 'RightUpLeg'
  | 'RightLeg'
  | 'RightFoot'
  | 'RightToeBase'
  | 'RightToe_End'

export const BoneNames: BoneNames[] = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'HeadTop_End',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'LeftHandIndex1',
  'LeftHandIndex2',
  'LeftHandIndex3',
  'LeftHandIndex4',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'RightHandIndex1',
  'RightHandIndex2',
  'RightHandIndex3',
  'RightHandIndex4',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'LeftToeBase',
  'LeftToe_End',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'RightToeBase',
  'RightToe_End',
]

export const CostumeAttachment = t.intersection(
  [
    t.type({
      uuid: t.string,
      bone: t.string,
      wearable_id: t.union([t.number, t.string]),
      position: t.array(t.number),
      rotation: t.array(t.number),
      scaling: t.array(t.number),
    }),
    t.partial({
      name: t.string, // optional
      collection_id: t.number,
      chain_id: t.number,
      collection_address: t.string,
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
