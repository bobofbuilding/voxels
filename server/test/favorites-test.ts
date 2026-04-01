import test from 'tape'
import Favorites from '../favorite-parcel'

test('Favorites#object', (t) => {
  const p = new Favorites({ id: 42, parcel_id: 670 })
  t.ok(p)
  t.equal(p.parcel_id, 670)
  t.end()
})

test('Favorites#IsNotFavorite', async (t) => {
  const favoriteObject = await Favorites.loadFromWalletAndParcelId('a', 670)
  t.notOk(favoriteObject)
  t.end()
})

test('Favorites#Create', async (t) => {
  const p = new Favorites({ wallet: 'a', parcel_id: 670 })
  const response = await p.create()
  t.ok(response)
  t.true(response.success)
  t.end()
})

test('Favorites#IsFavorite', async (t) => {
  const favoriteObject = await Favorites.loadFromWalletAndParcelId('a', 670)
  t.ok(favoriteObject)
  t.equal(favoriteObject.parcel_id, 670)
  t.equal(favoriteObject.wallet, 'a')
  t.end()
})

test('Favorites#UnFavorite', async (t) => {
  const favoriteObject = await Favorites.loadFromWalletAndParcelId('a', 670)
  t.ok(favoriteObject)
  const response = await favoriteObject.remove()
  t.ok(response)
  t.ok(response.success)
  t.end()
})

test('Favorites#IsNotFavorite', async (t) => {
  const favoriteObject = await Favorites.loadFromWalletAndParcelId('a', 670)
  t.notOk(favoriteObject)
  t.end()
})
