import { ethers } from 'ethers'
import { Request, Response } from 'express'
import Collection from '../collection'
import { collectionHasValidURI, getTransactionReceipt, isAddressAContract } from '../lib/ethereum-helpers'
import { isMod } from '../lib/helpers'
import db from '../pg'
import { VoxelsUserRequest } from '../user'

export async function createCollection(req: Request, res: Response) {
  const { name, description, image_url, owner, slug, type, chainId, settings } = req.body

  const collection = new Collection({ name, description, image_url, owner, slug, type, chainId, settings })

  const isValid = await collection.isValid()
  if (!isValid.success) {
    res.json({ success: !!isValid.success, message: isValid.message })
    return
  }

  const response = await collection.create()

  // The collection factory and the collection are not perfectly synced.
  // It is possible for the collection factory to have higher indexes than the collections Table.
  // This means that on creation of a collection, the id can be "already taken" on the chain.
  // Therefore we check if ID is already on chain and update the ID on the DB (we then re-sync the PSQL sequence)

  await collection.syncCollectionID()

  res.json({ success: !!response, collection: { id: collection.id } })
}

export async function removeCollection(req: VoxelsUserRequest, res: Response) {
  const { id } = req.body

  const owner = req.user?.wallet
  if (!owner) {
    res.status(403).json({ success: false })
    return
  }

  const collection = new Collection({ id, owner })

  await collection.remove()

  res.json({ success: true, collection: { id: collection.id } })
}

export async function discontinueCollection(req: VoxelsUserRequest, res: Response) {
  const { address, slug, id } = req.body

  const chainId = req.body.chainid

  const owner = req.user?.wallet
  if (!owner) {
    res.status(403).json({ success: false })
    return
  }

  const collection = new Collection({ id, owner, address, slug, chainId })

  await collection.discontinue()

  res.json({ success: true, collection: { id: collection.id } })
}

export async function updateCollection(req: VoxelsUserRequest, res: Response) {
  const { id, name, description, image_url, address, slug, type, settings, customAttributesNames } = req.body
  const owner = req.user?.wallet
  if (!owner) {
    res.status(403).json({ success: false })
    return
  }
  const chainId = req.body.chainid

  const collection = new Collection({ id, name, description, image_url, owner, address, slug, type, chainId, settings, customAttributesNames })

  const isValid = await collection.isValid()
  if (!isValid.success) {
    res.json({ success: !!isValid.success, message: isValid.message })
    return
  }

  if ('owner' in req.body && req.body.owner.toLowerCase() !== owner.toLowerCase()) {
    await collection.transferOwner(req.body.owner)
  }

  await collection.update()

  res.json({ success: true, collection: collection })
}

export async function suppressCollection(req: VoxelsUserRequest, res: Response) {
  const { id } = req.body
  const owner = req.user?.wallet
  if (!owner) {
    res.status(403).json({ success: false })
    return
  }

  if (!isMod(req)) {
    return
  }

  const collection = await Collection.loadFromId(id)
  if (!collection) {
    res.json({ success: false })
    return
  }

  await collection.toggleSuppress()

  res.json({ success: true, collection: { id: collection.id } })
}

export async function checkValidity(req: Request, res: Response) {
  const { name, slug } = req.body

  const collection = new Collection({ name, slug })

  const isValid = await collection.isValid()

  res.json({ success: !!isValid.success, message: isValid.message })
}

export async function updateAddress(req: Request, res: Response) {
  const { id, address } = req.body
  const collection = await Collection.loadFromId(id)

  if (!collection || collection.chainId === null) {
    res.json({ success: false })
    return
  }

  if (!ethers.isAddress(address) && ethers.isHexString(address)) {
    // Address is a transaction hash.
    // Grab the transaction receipt of said tx
    const txReceipt = await getTransactionReceipt(address, collection.chainId)
    if (!txReceipt) {
      res.json({ success: false, message: 'could no get Transaction, please try again' })
      return
    }

    // Grab the address logged in that transaction
    const contractAddress = txReceipt.logs[0].address

    if (!ethers.isAddress(contractAddress)) {
      res.json({ success: false, message: 'Contract address from this TX is invalid.' })
      return
    }

    const check = await collectionAlreadyExists(contractAddress)
    if (check) {
      res.json({ success: false, message: 'This collection already exists' })
      return
    }

    collection.address = contractAddress
  } else if (!!ethers.isAddress(address)) {
    const isContract = await isAddressAContract(address, collection.chainId)
    if (!isContract) {
      res.json({ success: false, message: 'This address is not a contract' })
      return
    }
    // Check if we aready have that address
    const check = await collectionAlreadyExists(address)
    if (check) {
      res.json({ success: false, message: 'This collection already exists' })
      return
    }

    collection.address = address
  } else {
    res.json({ success: false, message: 'Invalid input' })
    return
  }

  const isValid = await collectionHasValidURI(collection)

  if (!isValid) {
    res.json({ success: false, message: 'Contract Address is invalid' })
    return
  }

  const response = await collection.updateAddress()

  res.json({ success: !!response.success })
}

async function collectionAlreadyExists(address: string): Promise<boolean> {
  const res = await db.query('embedded/get-collection', 'select count(id) from collections where lower(address)=lower($1)', [address])

  const count = res.rows[0].count

  // Check if we already have that address
  return count > 0
}
