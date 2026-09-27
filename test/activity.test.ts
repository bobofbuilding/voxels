import { h } from 'preact'
import { renderView, stubFetch } from './view-helper'
import { expect, test } from 'vitest'
import Activity from '../web/src/activity'

test('activity renders a transfer row', async () => {
  stubFetch({
    '/api/activity.json': {
      success: true,
      transfers: [
        {
          hash: '0xabc',
          parcel_id: 42,
          created_at: new Date().toISOString(),
          name: 'the pier',
          address: null,
          from: { owner: '0x0000000000000000000000000000000000000000' },
          to: { owner: '0x1234567890abcdef1234567890abcdef12345678', name: 'ben' },
          synced: false,
        },
      ],
    },
  })

  const root = await renderView('activity', h(Activity, {}), 'tbody tr')
  const cells = root.querySelectorAll('tbody td')
  expect(cells[1].textContent).toBe('the pier')
  expect(cells[2].textContent).toBe('minted')
  expect(cells[3].textContent).toBe('ben')
  expect(cells[4].textContent).toBe('stale')
})
