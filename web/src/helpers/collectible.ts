import { SUPPORTED_CHAINS_BY_ID } from '../../../common/helpers/chain-helpers'
import { CollectibleInfoRecord, CollectibleRecord } from '../../../common/messages/collectibles'
import { WearableCategory } from '../../../web/types'
import { getWearableGif } from './wearable-helpers'
import { AvatarRef, avatarName, avatarSlug } from '../../../common/messages/avatar-ref'

export default class WearableHelper {
  // always present
  token_id: number
  collection_id: number

  // not present when data is from Blockchain.
  id?: string
  author?: string
  name?: string
  description: string | null = null
  category: WearableCategory | null = null
  created_at?: any
  suppressed = false
  updated_at?: any
  hash?: string
  issues?: number
  offer_prices?: number[]

  // From metadata endpoint
  image?: string

  // From subgraph
  quantity?: number

  // from collection:
  chain_id?: number
  collection_address?: string
  collection_name?: string

  constructor(obj: CollectibleRecord | CollectibleInfoRecord) {
    Object.assign(this, obj)
    if (!this.chain_id) this.chain_id = 0
    this.token_id = obj.token_id ?? 0
    this.collection_id = obj.collection_id ?? 0
  }

  get isLoaded() {
    return typeof this.id !== 'undefined' && typeof this.collection_id !== 'undefined' && typeof this.token_id !== 'undefined'
  }

  get openseaUrl() {
    return (this.isMainnet() ? 'https://opensea.io/assets/ethereum/' : 'https://opensea.io/assets/matic/') + `${this.collection_address}/${this.token_id}`
  }

  get metadataURL() {
    return `/c/v2/${SUPPORTED_CHAINS_BY_ID[this.chain_id ?? 1]}/${this.collection_address}/${this.token_id}`
  }

  isMainnet() {
    return this.chain_id == 1
  }

  isSuppressed() {
    return !!this.suppressed
  }

  gif() {
    if (this.image) {
      return this.image
    }
    return getWearableGif(this)
  }

  collectionPage() {
    return `/collections/${SUPPORTED_CHAINS_BY_ID[this.chain_id ?? 1]}/${this.collection_address}`
  }

  collectiblePage() {
    return `/collections/${SUPPORTED_CHAINS_BY_ID[this.chain_id ?? 1]}/${this.collection_address}/${this.token_id}`
  }

  isAuthor(wallet: string | null) {
    if (!wallet || !this.author) return false
    const w = typeof this.author === 'string' ? this.author : (this.author as AvatarRef as any).owner
    return wallet.toLowerCase() === w.toLowerCase()
  }

  ownerName() {
    return this.author ? avatarName(this.author as AvatarRef) : '...'
  }

  ownerSlug() {
    return this.author ? avatarSlug(this.author as AvatarRef) : ''
  }

  summary(): CollectibleRecord | CollectibleInfoRecord {
    const properties = []
    for (const key in this) {
      if (this.hasOwnProperty(key) && typeof this[key] !== 'function') {
        properties.push({ [key]: this[key] })
      }
    }
    return Object.assign({}, ...properties)
  }
}
