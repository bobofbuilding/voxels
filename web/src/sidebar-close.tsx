import { getCoords } from './helpers/coords-nav'
import { route } from 'preact-router'

/** Hide the page column: full-bleed world via /play. */
export function closePageSidebar(e?: Event) {
  e?.preventDefault()
  e?.stopPropagation()
  const c = getCoords()
  route(c ? `/play?coords=${encodeURIComponent(c)}` : '/play')
}
