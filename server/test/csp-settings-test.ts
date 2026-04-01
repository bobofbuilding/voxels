import test from 'tape'
// @ts-ignore
import csp from '../csp-settings'

test('csp', (t) => {
  const c = csp()
  t.ok(c)
  t.end()
})
