import { h } from 'preact'
import { renderView, stubFetch } from './view-helper'
import { expect, test } from 'vitest'
import Explore from '../web/src/explore'

test('explore renders the sidebar', async () => {
  stubFetch({})

  const root = await renderView('explore', h(Explore, {}), 'section.explorer h3')
  expect(root.querySelector('h1')!.textContent).toBe('Voxels')
})
