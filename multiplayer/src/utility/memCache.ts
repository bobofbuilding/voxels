import { isAbortError } from './abortError'

export type MemCache<Value> = {
  getOrCreate(maxAgeMs: number): Promise<{ value: Value; age: number }>
}

export function create<Value>(valueGenerator: () => Promise<Value>): MemCache<Value> {
  let currentValue: { value: Value; timestamp: number } | null = null
  let nextValuePromise: Promise<Value> | null = null

  return {
    getOrCreate: async (maxAge) => {
      const now = Date.now()
      const age = currentValue ? now - currentValue.timestamp : Infinity

      if (currentValue && age < maxAge) {
        return { value: currentValue.value, age }
      }

      if (!nextValuePromise) {
        nextValuePromise = valueGenerator()

        nextValuePromise
          .then((value) => {
            const timestamp = Date.now()
            currentValue = { value, timestamp }
          })
          .catch((err) => {
            if (isAbortError(err)) return
            throw err
          })
          .finally(() => {
            nextValuePromise = null
          })
      }

      return { value: await nextValuePromise, age: 0 }
    },
  }
}
