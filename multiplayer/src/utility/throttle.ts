import { setTimeout as setTimeoutPromise } from 'node:timers/promises'

/**
 * Throttle a function so that it will be called at max once per throttle period.
 * Function will be executed immediately and if it is called again within
 * throttle period it will be executed again at end of throttle,
 * triggering another throttle period and so on until calls cease
 */
export function throttle(
  funk: (abort: AbortSignal) => Promise<void>,
  throttlePeriod: number,
  abort: AbortSignal,
): () => void {
  let throttleCallers = false
  let throttledCalls = 0
  let throttling = false

  return async () => {
    if (throttleCallers === true) {
      throttledCalls++
      return
    }

    throttleCallers = true
    throttling = true
    try {
      while (throttling === true && !abort.aborted) {
        // reset throttled calls counter
        throttledCalls = 0
        // first call function
        await funk(abort)
        // then await the delay
        await setTimeoutPromise(throttlePeriod, null, { signal: abort })
        // if any calls occured while waiting trigger again
        if (throttledCalls < 1) {
          throttling = false
        }
      }
    } catch (error) {
      if (abort.aborted) return // suppress abort error
      // todo if error occurs in funk, throttling will not occur. Desired behaviour?

      throw error
    } finally {
      throttleCallers = false
    }
  }
}
