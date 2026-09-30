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
          to: { owner: '0x1234567890abcdef1234567890abcdef12345678', name: 'example' },
          synced: false,
        },
      ],
    },
  })

  const root = await renderView('activity', h(Activity, {}), 'ol.activity-feed li')
  expect(root.querySelector('.activity-parcel')!.textContent).toBe('the pier')
  expect(root.querySelector('.activity-people')!.textContent).toContain('Minted by')
  expect(root.querySelector('.activity-people')!.textContent).toContain('example')
})
