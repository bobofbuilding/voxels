import Head from './components/head'
import { NewMarket } from './components/new-market-parcels'

type Props = {
  path?: string
}

export function NewParcels(props: Props) {
  return (
    <section>
      <Head title={'New Parcel Listings'} description={'See all latest parcels'} url={''} />

      <br />
      <div style={{ display: 'flex', flex: 1, width: '100%' }}>
        <hgroup style={{ flexGrow: 1 }}>
          <h1>New Parcel Listings</h1>
          <p>List of all newly listed parcels.</p>
        </hgroup>
        <div>
          <button class="outline" onClick={() => window.open('https://opensea.io/collection/cryptovoxels', '_blank')}>
            Opensea
          </button>
        </div>
      </div>
      <section>
        <NewMarket showHeader={false} showEmpty={true} />
      </section>
    </section>
  )
}
