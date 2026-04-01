import { bucketUrl, renderUrl } from '../../../web/src/assets'
import { LibraryAsset } from '../../library-asset'
import Image from '../../../web/src/components/image'
import { shorterWallet } from '../../../common/helpers/utils'

export function AssetCard(props: { asset: LibraryAsset }) {
  const asset = props.asset

  const owner = shorterWallet(asset.author)

  return (
    <div class="AssetCard -small">
      <header>
        <div class="name">{asset.name || 'My Asset'}</div>
      </header>
      {asset.id && <Image src={bucketUrl(asset.id)} altsrc={renderUrl(asset.id)} />}

      <footer>
        <div class="author">Author: {asset.author_name || owner}</div>
      </footer>
    </div>
  )
}
