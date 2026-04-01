import * as t from 'io-ts'
import { NullableNum, NullableStr } from './feature'

export const Optional = <T extends t.Mixed>(type: T) => t.union([type, t.null, t.undefined])

export const TraitRecord = t.type(
  {
    trait_type: t.string,
    value: t.union([t.number, t.string, t.null, t.undefined]),
    display_type: NullableStr,
    ignore: t.union([t.boolean, t.undefined]),
  },
  'TraitRecord',
)

export enum TraitDisplayTypes {
  StringTrait = 'string_trait',
  Number = 'number',
  BoostPercentage = 'boost_percentage',
  BoostNumber = 'boost_number',
}

export const TRAIT_DISPLAY_TYPES = [
  { type: null, name: '' },
  { type: TraitDisplayTypes.StringTrait, name: 'Text' },
  { type: TraitDisplayTypes.Number, name: 'Number' },
  { type: TraitDisplayTypes.BoostPercentage, name: 'Boost Percentage' },
  { type: TraitDisplayTypes.BoostNumber, name: 'Boost Number' },
]

export const CollectibleRecord = t.intersection(
  [
    t.type({
      id: NullableStr,
      token_id: t.number,
      collection_id: t.number,
      name: t.string,
      description: NullableStr,
      created_at: t.union([NullableStr, t.undefined]),
      rejected_at: t.union([NullableStr, t.undefined]),
      updated_at: t.union([NullableStr, t.undefined]),
      issues: t.union([NullableNum, t.undefined]),
      hash: t.string,
      category: NullableStr,
      author: NullableStr,
    }),
    t.partial({
      quantity: t.number,
      chain_id: t.number,
      collection_address: NullableStr,
      collection_name: NullableStr,
      image: NullableStr,
      author_name: NullableStr,
      collection_attributes_names: t.union([t.array(TraitRecord), t.null]), // attributes definition by collection
      custom_attributes: t.union([t.array(TraitRecord), t.null]), // attributes for htat specific collectible
    }),
  ],
  'CollectibleRecord',
)
export type CollectibleRecord = t.TypeOf<typeof CollectibleRecord>

// subgraphs.crvox.com/api/assets/complete/{wallet}.json
export const ApiAssetMessage = t.type(
  {
    success: t.boolean,
    assets: t.array(CollectibleRecord),
  },
  'ApiAssetMessage',
)
export type ApiAssetMessage = t.TypeOf<typeof ApiAssetMessage>

// {"token_id":1,"chain_id":"137","collection_address":"0x9306af3f24f54a5000d1fd9eb740fcc699bb12e1","collection_id":67,"quantity":1}
export const CollectibleInfoRecord = t.type(
  {
    id: t.string, // UUID
    name: Optional(t.string),
    description: Optional(t.string),
    author: Optional(t.string),
    issues: Optional(t.number),
    token_id: Optional(t.number),
    created_at: Optional(t.string), // ISO timestamp
    updated_at: Optional(t.string), // ISO timestamp
    hash: t.string,
    rejected_at: Optional(t.string),
    offer_prices: Optional(t.array(t.string)), // numeric[] as strings from JSON
    collection_id: t.number,
    custom_attributes: Optional(t.array(t.UnknownRecord)), // json[]
    suppressed: Optional(t.boolean),
    category: Optional(t.string),
    default_settings: Optional(t.UnknownRecord), // json
    // Required for CollectibleInfoRecord base
    quantity: t.number,
    chain_id: t.string,
    collection_address: t.string,
  },
  'CollectibleInfoRecord',
)
export type CollectibleInfoRecord = t.TypeOf<typeof CollectibleInfoRecord>

// subgraphs.crvox.com/api/assets/{wallet}.json
export const AssetInfoMessage = t.type(
  {
    success: t.boolean,
    assets: t.array(CollectibleInfoRecord),
  },
  'ApiAssetMessage',
)
export type ApiAssetInfoMessage = t.TypeOf<typeof ApiAssetMessage>

// /api/collections/:chain_identifier/:address/collectibles.json
export const CollectibleBatchRecord = t.type(
  {
    id: NullableStr,
    token_id: t.number,
    name: t.string,
    description: NullableStr,
    collection_id: t.number,
    category: NullableStr,
    author: NullableStr,
    hash: t.string,
    suppressed: t.boolean, // ?
    chain_id: t.number,
    collection_address: NullableStr,
    collection_name: NullableStr,
  },
  'CollectibleBatchRecord',
)
export type CollectibleBatchRecord = t.TypeOf<typeof CollectibleBatchRecord>

export const CollectibleBatchMessage = t.type(
  {
    success: t.boolean,
    collectibles: t.array(CollectibleBatchRecord),
  },
  'CollectibleBatchMessage',
)
export type CollectibleBatchMessage = t.TypeOf<typeof CollectibleBatchMessage>
