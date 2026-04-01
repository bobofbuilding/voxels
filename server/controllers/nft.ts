import cache from '../cache'
import { Express, Response } from 'express'
import { Db } from '../pg'
import { PassportStatic } from 'passport'
import { ethAlchemy } from '../lib/utils'

function spammy(nft: any) {
  let score = 0

  if (nft.rawMetadata?.description?.match(/claim reward/)) {
    score += 0.4
  }

  if (nft.rawMetadata?.name?.match(/^visit /i)) {
    score += 0.4
  }

  if (nft.rawMetadata?.name?.match(/\bairdrop\b/i)) {
    score += 0.2
  }

  if (!nft.rawMetadata?.name && !nft.rawMetadata?.description) {
    score += 0.6
  }

  return score
}

export default function NftController(db: Db, passport: PassportStatic, app: Express) {
  app.get('/api/nfts/:wallet', cache('1 minute'), async (req, res) => {
    const wallet = req.params.wallet

    // Get how many NFTs an address owns.
    const response = await (ethAlchemy as any).nft.getNftsForOwner(wallet)
    const total = response.totalCount
    var nfts = response.ownedNfts

    nfts = nfts.filter((nft: any) => spammy(nft) < 0.5)
    res.json({ nfts, total })
  })
}

//     const options = {method: 'GET', headers: {accept: 'application/json'}};

// fetch('https://worldchain-mainnet.g.alchemy.com/v2/EmvmpW109VE8WSfn1470T/getNFTsForOwner?owner=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&withMetadata=true&pageSize=100', options)
//   .then(response => response.json())
//   .then(response => console.log(response))
//   .catch(err => console.error(err));
