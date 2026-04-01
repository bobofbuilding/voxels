import pDefer, { DeferredPromise } from 'p-defer'

const symbols = ['ALLES'] as const

let onLoadDonePromiseDone = false
const onSymbolLoadDeferreds = new Map<string, DeferredPromise<void>>(symbols.map((s) => [s, pDefer<void>()]))

// Runs after all symbols have loaded, but before anything queued with onLoadPromise.then()
const done = () => {
  const spinner = document.querySelector('.loading-spinner')

  if (spinner) {
    spinner.remove()
  }

  const canvas = document.querySelector('#renderCanvas') as HTMLCanvasElement | null
  if (canvas) {
    canvas.style.opacity = '1'
  }
  onLoadDonePromiseDone = true
}

// Callers can use onLoadPromise.then(() => blah) to do their thing after all loading has finished.
export const onLoadPromise = Promise.all(Array.from(onSymbolLoadDeferreds.values()).map((d) => d.promise)).then(done)

export const loadingDone = (symbol: (typeof symbols)[number]) => {
  onSymbolLoadDeferreds.get(symbol)?.resolve()
}

export const isLoaded = () => {
  return onLoadDonePromiseDone
}
