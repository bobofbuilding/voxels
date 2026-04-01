/*
 * When embedded in Opensea (or other sandboxed iframes) - we need to stub
 * a bunch of stuff that causes a SecurityException
 */

try {
  const testKey = '__test__'
  window.localStorage.setItem(testKey, '1')
  window.localStorage.removeItem(testKey)
} catch {
  console.log('[voxels] Stubbing localStorage')

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
    configurable: true,
  })

  Object.defineProperty(window, 'sessionStorage', {
    value: undefined,
    configurable: true,
  })

  Object.defineProperty(window, 'indexedDB', {
    value: undefined,
    configurable: true,
  })

  Object.defineProperty(navigator, 'storage', {
    value: {},
    configurable: true,
  })
}
