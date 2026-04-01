import cache from '../cache'
import { Db, DBPromise, pgp } from '../pg'
import { Express, Router } from 'express'
import { ethers } from 'ethers'
import QLRU from 'quick-lru'
import { convertEthToUsd } from '../lib/prices'

type ParcelListing = {
  id: number
  name: string
  address: string
  priceEth: number // in ETH
  priceUsd: number
}

type ListingsById = Record<string, ParcelListing>

export default function (pgp: DBPromise) {
  const r = Router()

  const OPENSEA_API_KEY = process.env.OPENSEA_APIKEY
  const CONTRACT = process.env.CONTRACT_ADDRESS
  const MAKER = '0x2D891ED45C4C3EAB978513DF4B92a35Cf131d2e2'

  // 5 minute cache
  const lru = new QLRU({ maxAge: 1000 * 60 * 5, maxSize: 100 })

  async function extractParcels(openseaResponse: any): Promise<ListingsById> {
    const parcels: ListingsById = {}

    for (const order of openseaResponse.orders) {
      const asset = order?.maker_asset_bundle?.assets?.[0]
      if (!asset) continue

      const id = asset.token_id
      const name = asset.name
      const address = asset.external_link
      const price = parseFloat(order.current_price) / 1e18
      const priceUsd = await convertEthToUsd(price)

      parcels[id] = { id, name, address, priceEth: price, priceUsd }
    }

    return parcels
  }

  async function fetchListings(): Promise<ListingsById> {
    if (lru.has('/listings')) {
      return lru.get('/listings') as ListingsById
    }

    const response = await fetch(`https://api.opensea.io/api/v2/orders/ethereum/seaport/listings?asset_contract_address=${CONTRACT}&maker=${MAKER}`, {
      method: 'GET',
      headers: {
        accept: '*/*',
        'x-api-key': OPENSEA_API_KEY!,
      },
    })

    const data = await response.json()
    const parcels = await extractParcels(data)
    lru.set('/listings', parcels)

    return parcels
  }

  r.get('/listings', async (req, res) => {
    const listings = await fetchListings()
    res.json({ ok: true, listings })
  })

  r.get('/listings/:id', async (req, res) => {
    // Parcel id
    const { id } = req.params
    const listings = await fetchListings()

    if (listings[id]) {
      const listing = listings[id]
      res.json({ ok: true, listing })
    } else {
      res.status(404).json({ ok: false, error: 'Listing not found' })
    }
  })

  r.get('/summary', cache('5 minutes'), async (req, res) => {
    const summary = await pgp.manyOrNone(`
      SELECT
        i.id,
        i.name,
        (
          SELECT COALESCE(
            json_agg(json_build_object('id', p.id, 'address', p.address, 'owner', p.owner) ORDER BY p.id),
            '[]'::json
          )
          FROM 
            properties p
          WHERE 
            p.island = i.name
        ) AS parcels
      FROM 
        islands i
      ORDER BY 
        i.id DESC
      LIMIT 
        3;
    `)

    res.status(200).send({ ok: true, summary })
  })

  return r
}
