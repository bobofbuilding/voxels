import * as t from 'io-ts'

export const TokenURIRecord = t.type(
  {
    raw: t.string,
    gateway: t.string,
  },
  'TokenURIRecord',
)
export type TokenURIRecord = t.TypeOf<typeof TokenURIRecord>

export const TokenAttributeRecord = t.type(
  {
    value: t.string,
    trait_type: t.string,
  },
  'TokenAttributeRecord',
)
export type TokenAttributeRecord = t.TypeOf<typeof TokenAttributeRecord>

export const TokenMetadataRecord = t.type(
  {
    name: t.string,
    description: t.string,
    image: t.union([t.string, t.undefined]),
    image_url: t.union([t.string, t.undefined]),
    animation_url: t.union([t.string, t.undefined]),
    url: t.union([t.string, t.undefined]),
    external_url: t.union([t.string, t.undefined]),
    attributes: t.array(TokenAttributeRecord),
  },
  'TokenMetadataRecord',
)
export type TokenMetadataRecord = t.TypeOf<typeof TokenMetadataRecord>

export const TokenIdRecord = t.type(
  {
    tokenId: t.string,
    tokenMetadata: t.record(t.string, t.string),
  },
  'TokenIdRecord',
)
export type TokenIdRecord = t.TypeOf<typeof TokenIdRecord>

export const AlchemyNFTWithMetadata = t.type(
  {
    contract: t.record(t.string, t.any),
    id: TokenIdRecord,
    title: t.string,
    description: t.string,
    tokenUri: TokenURIRecord,
    media: t.array(TokenURIRecord),
    metadata: TokenMetadataRecord,
    timeLastUpdated: t.string,
    error: t.union([t.string, t.undefined]),
  },
  'AlchemyNFTWithMetadata',
)
export type AlchemyNFTWithMetadata = t.TypeOf<typeof AlchemyNFTWithMetadata>

/**
 * /api/externals/alchemy/nfts.json
 */
export const AlchemyNFTAPIWithMetadata = t.type(
  {
    ownedNfts: t.array(AlchemyNFTWithMetadata),
    totalCount: t.number,
    blockHash: t.string,
    pageKey: t.union([t.string, t.undefined]),
  },
  'AlchemyNFTAPIWithMetadata',
)
export type AlchemyNFTAPIWithMetadata = t.TypeOf<typeof AlchemyNFTAPIWithMetadata>
