import { SUPPORTED_CHAINS_BY_ID } from '../../../common/helpers/chain-helpers'
import { CollectibleInfoRecord, CollectibleRecord } from '../../../common/messages/collectibles'
import { TraitType } from '../components/collections/custom-collection-traits'
import { PanelType } from '../components/panel'
import { app } from '../state'
import { WearableCategory } from '../upload-wearable'
import { getWearableGif } from './wearable-helpers'

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
  custom_attributes?: TraitType[] // attributes for htat specific collectible

  // from the server apis:
  author_name?: string
  collection_attributes_names?: TraitType[] // attributes definition by collection

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

  collectionHasAttributes() {
    if (!this.collection_attributes_names) {
      return false
    }
    return this.collection_attributes_names?.length > 0
  }

  gif() {
    if (this.image) {
      return this.image
    }
    return getWearableGif(this)
  }

  hasAttributes() {
    if (!this.custom_attributes) {
      return false
    }
    return this.custom_attributes?.length > 0 && this.collection_attributes_names?.length == this.custom_attributes?.length
  }

  collectionPage() {
    return `/collections/${SUPPORTED_CHAINS_BY_ID[this.chain_id ?? 1]}/${this.collection_address}`
  }

  collectiblePage() {
    return `/collections/${SUPPORTED_CHAINS_BY_ID[this.chain_id ?? 1]}/${this.collection_address}/${this.token_id}`
  }

  isAuthor(wallet: string | null) {
    if (!wallet || !this.author) {
      return false
    }
    return wallet.toLowerCase() === this.author.toLowerCase()
  }

  /* helpers to get author name */
  ownerName() {
    return this.author_name || this.author?.slice(0, 10).toLowerCase() + '...'
  }

  fetchMetaData = async () => {
    if (!this.collection_address) {
      return null
    }

    let r
    try {
      r = await fetch(`${process.env.ASSET_PATH}${this.metadataURL}`)
    } catch {
      return null
    }
    const res: {
      symbol?: string | undefined
      name: string | undefined
      image: string
      description: string | undefined
      attributes: TraitType[]
      external_url: string
      background_color: string
      success?: undefined
    } = await r.json()

    if (!res.name) {
      return null
    }
    this.image = res.image ?? this.image
    this.name = res.name
    this.suppressed = !!res.attributes.find((a: TraitType) => a.trait_type == 'suppressed')?.value
    const issues = res.attributes.find((a: TraitType) => a.trait_type == 'issues')?.value
    this.issues = typeof issues === 'string' ? parseInt(issues) : issues

    return res
  }

  toggleSuppress = async (callback?: (success: boolean) => void) => {
    if (!confirm(`Are you sure you want to ${this.isSuppressed() ? 'unsuppress' : 'suppress'} this wearable?`)) {
      return
    }
    const url = `${process.env.API}/collectibles/w/${this.id}/${this.isSuppressed() ? 'unsuppress' : 'suppress'}`

    let p
    try {
      p = await fetch(url, { method: 'POST' })
    } catch {
      app.showSnackbar(`❌ Could not ${this.isSuppressed() ? 'unrejected' : 'rejected'}`, PanelType.Danger)
      return
    }

    const r = await p.json()

    if (r.success) {
      app.showSnackbar('✅ ' + this.id + ` was ${this.isSuppressed() ? 'unrejected' : 'rejected'}`, PanelType.Success)
      callback && callback(true)
    } else {
      app.showSnackbar(r.message || `❌ Could not ${this.isSuppressed() ? 'unrejected' : 'rejected'}`, PanelType.Danger)
      callback && callback(false)
    }
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
