import { h } from 'preact'
import { renderView, stubFetch } from './view-helper'
import { expect, test } from 'vitest'
import Blog from '../web/src/blog'

test('blog lists posts', async () => {
  stubFetch({
    '/api/posts.json': { success: true, posts: [{ slug: 'cars', title: 'we added cars', body: 'vroom', author: 'ben', created_at: '2026-09-01T00:00:00Z', replies: 3 }] },
  })

  const root = await renderView('blog', h(Blog, {}), 'tbody tr')
  expect(root.querySelector('tbody a')!.textContent).toBe('we added cars')
})
