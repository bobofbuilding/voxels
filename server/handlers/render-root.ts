import { h } from 'preact'
import { render } from 'preact-render-to-string'

export default function renderRoot(rootNode: h.JSX.Element) {
  const html = render(rootNode, {})
  return `<!DOCTYPE html>\n${html}`
}
