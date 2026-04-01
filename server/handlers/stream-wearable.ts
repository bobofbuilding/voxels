import { ethers } from 'ethers'
import { Request, Response } from 'express'
import { ChainIdentifier, SUPPORTED_CHAINS, SUPPORTED_CHAINS_KEYS } from '../../common/helpers/chain-helpers'
import { isHex } from '../lib/helpers'
import Wearable from '../wearable'

const MAX_AGE = 60 * 60 * 24 * 7

export default async function streamWearable(req: Request, res: Response) {
  let wearable = null
  if ('hash' in req.params && req.params.hash.length > 39) {
    wearable = (await Wearable.loadFromHash(req.params.hash)) as Wearable
  }
  if (!wearable && typeof req.params.hash == 'number') {
    wearable = (await Wearable.loadFromTokenId(req.params.hash)) as Wearable
  }
  if ('collection_id' in req.params && 'token_id' in req.params) {
    // LEGACY
    const token_id: number = typeof req.params.token_id === 'number' ? req.params.token_id : parseInt(req.params.token_id, 10)
    const collection_id: number = typeof req.params.collection_id === 'number' ? req.params.collection_id : parseInt(req.params.collection_id, 10)

    if (isNaN(token_id) || isNaN(collection_id)) {
      return res.status(400).json({ success: false })
    }
    wearable = (await Wearable.loadFromTokenIdAndCollectionId(token_id, collection_id)) as Wearable
  } else if ('chain_identifier' in req.params && 'collection_address' in req.params) {
    // VERSION 2 THAT HANDLES CHAIN IDENTIFIER AND COLLECTION ADDRESS
    const identifier = req.params.chain_identifier
    const address = req.params.collection_address
    const tokenID = isHex(req.params.token_id) ? parseInt(req.params.token_id, 16) : parseInt(req.params.token_id, 10)

    if (!SUPPORTED_CHAINS_KEYS.includes(identifier) || !ethers.isAddress(address) || isNaN(tokenID)) {
      return res.status(400).json({ success: false })
    }
    wearable = await Wearable.loadFromChainInfo(SUPPORTED_CHAINS[identifier as ChainIdentifier], address, tokenID)
  }

  if (!wearable) {
    res.status(404).send({ success: false })
    return
  }

  const format = req.params.format

  if (format === 'vox' || format === '.vox') {
    res.set('Content-Type', 'application/octet-stream')
    res.setHeader('Cache-Control', `max-age=${MAX_AGE},immutable`)
    res.setHeader('Content-Disposition', `attachment; filename="${wearable.id}.vox"`)
    res.status(200).send(wearable.data)
  } else {
    res.status(404).send({ success: false })
  }
}
