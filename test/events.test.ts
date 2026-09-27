import { h } from 'preact'
import { renderView, stubFetch } from './view-helper'
import { expect, test } from 'vitest'
import Events from '../web/src/events'

test('events lists upcoming events', async () => {
  stubFetch({
    '/api/events.json': {
      success: true,
      events: [{ id: 7, name: 'rave on the pier', description: 'bring glowsticks', author: { name: 'ben', owner: '0x1234' }, starts_at: '2026-10-01T20:00:00Z', parcel_name: 'the pier' }],
    },
  })

  const root = await renderView('events', h(Events, {}), 'table.events a[href="/events/7"]')
  expect(root.querySelector('a[href="/events/7"]')!.textContent).toBe('rave on the pier')
})
