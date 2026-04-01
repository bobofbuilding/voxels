export class AbortError extends Error {
  constructor() {
    super('Aborted')
    this.name = 'Aborted'
  }
}

export const throwIfAborted = (abort: AbortSignal): void | never => {
  if (abort.aborted) throw new AbortError()
}

export const isAbortError = (error: any): boolean => {
  return (
    error instanceof AbortError ||
    error?.name === 'Aborted' ||
    error?.message === 'Aborted' ||
    error?.code === 'ABORT_ERR'
  )
}
