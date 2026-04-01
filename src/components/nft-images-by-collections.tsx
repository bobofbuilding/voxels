import { useState } from 'preact/hooks'
import { OpenSeaNFTV2Extended } from '../../common/messages/api-opensea'
import { imageUrlViaProxy } from '../utils/helpers'

export type Collection = { collection: string; items: OpenSeaNFTV2Extended[] }

interface NFTCollectionProps {
  collection: Collection
  callback?: (url?: string) => void
}

export default function NftCollectionsComponent(props: NFTCollectionProps) {
  const [collapsed, setCollapsed] = useState<boolean>(true)
  return (
    <div>
      <div className="category-name" onClick={() => setCollapsed(!collapsed)}>
        <h5>
          {collapsed ? '+ ' : '- '} {props.collection.collection}
        </h5>
      </div>
      <div className={`collapsible ${collapsed ? 'collapsed' : ''}`}>
        <NftsByCollections items={props.collection.items} callback={props.callback} />
      </div>
    </div>
  )
}

interface NftsByCollectionsProps {
  items: OpenSeaNFTV2Extended[]
  callback?: (url?: string) => void
}

function NftsByCollections(props: NftsByCollectionsProps) {
  const nftItems = props.items.map((nft: OpenSeaNFTV2Extended) => {
    let preview
    if (nft.image_url) {
      // proxy to avoid CSP and resize
      const resized = imageUrlViaProxy(nft.image_url, 55)
      preview = <img src={resized} width={55} height={55} title={nft.name || nft.permalink} alt={nft.name || nft.permalink} />
    } else {
      preview = <div style="color:#fff">{nft.name || nft.permalink}</div>
    }
    return <a onClick={() => props.callback?.(nft.permalink)}>{preview}</a>
  })
  return <div className="category-models">{nftItems}</div>
}
