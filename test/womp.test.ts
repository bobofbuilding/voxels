import { h } from 'preact'
import { renderView, stubFetch } from './view-helper'
import { expect, test } from 'vitest'
import Womp from '../web/src/womp'

test('womp shows the photo and who took it', async () => {
  stubFetch({
    '/api/womps/9.json': {
      success: true,
      womp: { id: 9, image_url: 'https://example.com/womp.jpg', author: { name: 'ben', owner: '0x1234' }, parcel_id: 42, parcel_name: 'the pier', created_at: '2026-09-01T00:00:00Z', coords: 'N@1E,2N', content: 'sunset' },
    },
  })

  const root = await renderView('womp', h(Womp, { id: '9' }), 'img.womp')
  expect(root.querySelector('img.womp')!.getAttribute('src')).toBe('https://example.com/womp.jpg')
  expect(root.querySelector('a[href="/parcels/42"]')!.textContent).toBe('the pier')
})
