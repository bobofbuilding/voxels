/**
 * A hack to simplify passing informative errors across processes/threads.
 * Better than trying to parse message strings, not as good as a proper factory that can recreate concrete subclasses of Error (but much lighter weight).
 */
export type ErrorWithType = {
  errorType?: string
  error: string
  stack?: string
}

export function createNamedError(errorWithType: ErrorWithType): Error
export function createNamedError(message: string, name: string, stack?: string): Error
export function createNamedError(errorWithTypeOrMessage: ErrorWithType | string, name?: string, stack?: string): Error {
  if (typeof errorWithTypeOrMessage !== 'string') {
    name = errorWithTypeOrMessage.errorType
    stack = errorWithTypeOrMessage.stack
    errorWithTypeOrMessage = errorWithTypeOrMessage.error
  }

  const e = new Error(errorWithTypeOrMessage)
  if (name != undefined) {
    e.name = name
  }
  if (stack != undefined) {
    e.stack = stack
  }

  return e
}
