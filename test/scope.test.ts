import { expect, test } from 'vitest'
import Scope from '../common/scope'

test('asset search URLs use an explicit origin and preserve query encoding', () => {
  const scope = Scope.parse('/api/assets', { q: 'chairs & tables', author: '0xabc', page: '2' })
  const url = new URL(scope.toString('https://example.com'))
  expect(url.origin).toBe('https://example.com')
  expect(url.searchParams.get('q')).toBe('chairs & tables')
  expect(scope.offset).toBe(100)
})
