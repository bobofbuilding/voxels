import { TraitDisplayTypes } from '../../common/messages/collectibles'
import Wearable from '../wearable'
import Collection from '../collection'
import { isHex } from '../../common/helpers/utils'
import { ethers } from 'ethers'
import { SUPPORTED_CHAINS, SUPPORTED_CHAINS_BY_ID, SUPPORTED_CHAINS_KEYS } from '../../common/helpers/chain-helpers'
import { Request, Response } from 'express'
import config from '../../common/config'

/*
collectible.id IS THE UUID, NOT TOKEN ID - courtesy of ben
*/
async function construct(wearable: Wearable): Promise<
  | { success: boolean }
  | {
      symbol?: string | undefined
      name: string | undefined
      image: string
      description: string | undefined
      attributes: any
      external_url: string
      background_color: string
      success?: undefined
    }
> {
  const imageSrc = config.wearablePreviewURL(wearable.id ?? null, wearable.name)

  // THis is to allow voting using those erc1155; Is needed for the scarcity votes.
  const isScarcityVotingTool = wearable.collection_id == 698 && (wearable.token_id == 5 || wearable.token_id == 6 || wearable.token_id == 170)

  const customAttributes = (wearable.custom_attributes || [])
    .filter((t: any) => !!t)
    .filter((t: any) => !t.ignore) // remove attributes we want to ignore for that collectible
    .filter((t: any) => (<any>Object).values(TraitDisplayTypes).includes(t.display_type))
    .map((t: any) => {
      delete t.ignore
      // don't add 'display_type' if it's a string attribute( opensea doesn't support it)
      return t.display_type == TraitDisplayTypes.StringTrait ? { trait_type: t.trait_type, value: t.value } : t
    })
  const otherAttributes = [
    { trait_type: 'vox', value: process.env.ASSET_PATH + `/w/${wearable.hash}/vox` },
    { trait_type: 'author', value: (await wearable.getAuthorName()) || wearable.author },
    { trait_type: 'issues', value: wearable.issues },
    { trait_type: 'rarity', value: wearable.rarity },
    { trait_type: 'suppressed', value: !!wearable.suppressed },
  ]

  const attributes = customAttributes.concat(otherAttributes)

  const collection = wearable.collection_id ? await Collection.loadFromId(wearable.collection_id) : null
  if (!collection) {
    return { success: false }
  }

  return {
    name: wearable.name,
    image: !!wearable.suppressed ? '' : imageSrc,
    // "animation_url": `https://jumbo.cryptovoxels.com/orbits/parcel-${parcel.id}.mp4`,
    description: !wearable.suppressed ? wearable.description : 'This Collectible has been suppressed and is not supported in Voxels.',
    attributes: attributes,
    external_url: collection.chainId !== null ? `https://www.voxels.com/collections/${SUPPORTED_CHAINS_BY_ID[collection.chainId]}/${collection.address}/${wearable.token_id}` : '',
    background_color: 'f3f3f3',
    ...(isScarcityVotingTool && { symbol: 'SCAR' }),
  }
}

export default async function getWearableMetadata(req: Request, res: Response) {
  // receives collection_id and token_id as parameters
  const tokenID = isHex(req.params.id) ? parseInt(req.params.id, 16) : parseInt(req.params.id, 10)

  const collectionID = parseInt(req.params.collection_id, 10)
  if (isNaN(tokenID) || isNaN(collectionID)) {
    return res.status(400).json({ success: false, message: 'not valid token_id or collection_id' })
  }
  const wearable = (await Wearable.loadFromTokenIdAndCollectionId(tokenID, collectionID)) as Wearable
  if (!wearable) {
    res.status(404).send({ success: false })
    return
  }
  res.json(await construct(wearable))
}

export async function getCollectibleMetadataV2(req: Request, res: Response) {
  // receives chain_id, addresss and token_id

  const tokenID = isHex(req.params.id) ? parseInt(req.params.id, 16) : parseInt(req.params.id, 10)
  const collectionAddress = req.params.address

  if (!ethers.isAddress(collectionAddress)) {
    return res.status(400).json({ success: false, message: 'not valid address' })
  }

  if (!SUPPORTED_CHAINS_KEYS.includes(req.params.chain_identifier)) {
    return res.status(400).json({ success: false, message: 'not valid chain identifier; eth,polygon supported' })
  }

  if (isNaN(tokenID)) {
    return res.status(400).json({ success: false, message: 'not valid token_id or collection_id' })
  }
  const chain_id = SUPPORTED_CHAINS[req.params.chain_identifier]
  const wearable = (await Wearable.loadFromChainInfo(chain_id, collectionAddress, tokenID)) as Wearable
  if (!wearable) {
    res.status(404).send({ success: false })
    return
  }
  res.json(await construct(wearable))
}
