import { useEffect, useState } from 'preact/hooks'

export function NewMarket({ showHeader = true, showEmpty = false }: { showHeader?: boolean; showEmpty?: boolean }) {
  const [listings, setListings] = useState<Record<string, any>>({})

  async function load() {
    const res = await fetch('/api/real-estate/listings')
    const data = await res.json()
    // console.log(data)

    if (data.ok) {
      setListings(data.listings)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const hasListings = Object.keys(listings).length > 0

  if (!hasListings && !showEmpty) {
    return null
  }

  return (
    <div>
      {showHeader && <h2>New to Market</h2>}

      <table class="new-to-market">
        <thead>
          <tr>
            <th>Parcel</th>
            <th>Name</th>
            <th>Price (ETH)</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(listings).length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center' }}>
                No new listings available.{' '}
                <a target={'_blank'} rel="noopener noreferrer" href="https://opensea.io/collection/cryptovoxels">
                  Check our secondary market in the meantime
                </a>
              </td>
            </tr>
          )}
          {Object.values(listings).map((listing: any) => (
            <tr key={listing.id}>
              <td>{listing.id}</td>
              <td>
                <a href={`/parcels/${listing.id}`}>{listing.name}</a>
              </td>
              <td>{listing.priceEth.toFixed(3)}Ξ</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
