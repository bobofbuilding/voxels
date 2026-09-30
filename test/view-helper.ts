import { mkdirSync, readFileSync, writeFileSync } from 'fs'
// @ts-ignore no types
import less from 'less'
import { render, VNode } from 'preact'
import { vi } from 'vitest'

// stubbed at import, not per test: some web modules (store/index.ts) fetch the moment they load.
// so tests import this file before the view
let canned: Record<string, any> = {}
vi.stubGlobal('fetch', async (url: any) => {
  const key = Object.keys(canned).find((k) => String(url).includes(k))
  return new Response(JSON.stringify(key ? canned[key] : { success: false }), { headers: { 'Content-Type': 'application/json' } })
})
vi.stubGlobal(
  'EventSource',
  class {
    close() {}
  },
)

// canned json by url substring, anything unmatched gets { success: false }
export function stubFetch(json: Record<string, any>) {
  canned = json
}

// render into a detached div and wait for the selector. always saves test-output/<name>.html
// (plus app.css) so ci can upload it, pass or fail
export async function renderView(name: string, view: VNode, selector: string) {
  const root = document.createElement('div')
  render(view, root)
  try {
    await vi.waitFor(() => {
      if (!root.querySelector(selector)) throw new Error(`no ${selector} yet`)
    })
  } finally {
    mkdirSync('test-output', { recursive: true })
    const css = await less.render(readFileSync('web/src/style/app.less', 'utf8'), { filename: 'web/src/style/app.less' })
    writeFileSync('test-output/app.css', css.css)
    writeFileSync(`test-output/${name}.html`, `<!doctype html><meta charset="utf-8"><title>${name}</title><link rel="stylesheet" href="app.css">${root.innerHTML}`)
  }
  return root
}
