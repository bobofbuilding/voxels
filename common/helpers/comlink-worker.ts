// ABOUTME: Comlink wrapper utility that provides worker functionality with main thread fallback
// ABOUTME: Used for running code in workers when available, or in main thread in sandboxed environments

import * as Comlink from 'comlink'
import { forceMainThreadWorkers } from './detector'

interface ComlinkWorkerResult<T> {
  worker: T
  cleanup: () => void
  isWorker: boolean
}

/**
 * Creates a worker with Comlink, falls back to main thread if workers unavailable
 *
 * NOTE: Use `() => new Worker(new URL('./worker.ts', import.meta.url))` - webpack 5
 * recognizes this pattern and compiles TypeScript workers to separate bundles
 */
export async function createComlinkWorker<T>(workerFactory: () => Worker, fallback: () => T | Promise<T>, options: { debug?: boolean; workerName?: string } = {}): Promise<ComlinkWorkerResult<T>> {
  // Force main thread if URL parameter is set
  if (forceMainThreadWorkers()) {
    if (options.debug) {
      const workerName = options.workerName || 'unknown-worker'
      console.warn(`[ComlinkWorker] MAIN THREAD MODE: Running ${workerName} in main thread via URL parameter`)
    }

    const api = await fallback()

    // Add verification that we're on main thread
    if (options.debug && typeof window !== 'undefined') {
      console.log('[ComlinkWorker] Confirmed main thread execution - window object available:', !!window)
    }

    return {
      worker: api,
      cleanup: () => {
        /* no-op for main thread */
      },
      isWorker: false,
    }
  }

  try {
    const worker = workerFactory()
    const api = Comlink.wrap<T>(worker)

    return {
      worker: api as T,
      cleanup: () => worker.terminate(),
      isWorker: true,
    }
  } catch (error) {
    if (options.debug) {
      console.warn('[ComlinkWorker] Falling back to main thread:', error)
    }

    const api = await fallback()

    return {
      worker: api,
      cleanup: () => {
        /* no-op for main thread */
      },
      isWorker: false,
    }
  }
}

/**
 * Creates a message handler that's properly wrapped for Comlink when needed
 */
export function createMessageHandler<T>(handler: (message: T) => void, isWorker: boolean) {
  return isWorker ? Comlink.proxy(handler) : handler
}
