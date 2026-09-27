import { h } from 'preact'
import { renderView, stubFetch } from './view-helper'
import { expect, test } from 'vitest'
import Parcel from '../web/src/parcel'

test('parcel shows its name', async () => {
  stubFetch({
    '/api/parcels/42.json': {
      success: true,
      parcel: { id: 42, name: 'the pier', address: '1 Pier Rd', owner: '0x1234', x1: 0, x2: 10, y1: 0, y2: 8, z1: 0, z2: 10, island: 'Origin City', suburb: 'Bay', minted: true, parcel_users: [] },
    },
  })

  const root = await renderView('parcel', h(Parcel, { id: 42 }), 'h2')
  expect(root.querySelector('h2')!.textContent).toContain('the pier')
})
