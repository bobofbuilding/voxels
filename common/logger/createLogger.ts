import { Logger, LoggerEngine, LogMeta } from './Logger'

export function createLogger(engine: LoggerEngine): Logger {
  const _void: void = undefined

  return {
    debug: (message, ...[meta]) => noThrow(() => engine.log('debug', ...prepareForEngine(message, meta)), _void),
    info: (message, ...[meta]) => noThrow(() => engine.log('info', ...prepareForEngine(message, meta)), _void),
    warn: (message, ...[meta]) => noThrow(() => engine.log('warn', ...prepareForEngine(message, meta)), _void),
    error: (message, ...[meta]) => noThrow(() => engine.log('error', ...prepareForEngine(message, meta)), _void),
    thrown: (error, message, ...[meta]) =>
      noThrow(() => {
        const [baseMessage, baseMeta] = prepareForEngine(message, meta)
        const errorMeta = noThrow(() => getErrorMeta(error), {
          message: '<error-during-resolution>',
          stack: '<error-during-resolution>',
        })
        const finalMessage = errorMeta.message === null ? baseMessage : `${baseMessage}: ${errorMeta.message}`
        engine.log('error', finalMessage, { ...baseMeta, ...errorMeta })
      }, _void),
  }
}

const prepareForEngine = (message: string, meta: LogMeta | undefined): [preparedMessage: string, preparedMeta: LogMeta] => {
  const preparedMeta = meta || {}
  const preparedMessage = Logger.runInterpolation(message, preparedMeta)
  return [preparedMessage, preparedMeta]
}

const getErrorMeta = (error: unknown): { message: string | null; stack: string | null } => {
  let messageResult: string | null = null
  let stackResult: string | null = null

  if (error) {
    if (typeof error === 'object') {
      if ('message' in error) {
        const { message } = error as { message: unknown }
        if (typeof message === 'string') {
          messageResult = message
        }
      }

      if ('stack' in error) {
        const { stack } = error as { stack: unknown }
        if (typeof stack === 'string') {
          stackResult = stack
        }
      }
    } else if (typeof error === 'string') {
      messageResult = error
    }
  }
  return { message: messageResult, stack: stackResult }
}

const noThrow = <T>(f: () => T, valueIfThrows: T) => {
  try {
    return f()
  } catch {
    return valueIfThrows
  }
}
