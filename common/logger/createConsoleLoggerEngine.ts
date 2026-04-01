import { LoggerEngine, LogLevel } from './Logger'

export function createConsoleLoggerEngine(console: Console, logLevel: LogLevel): LoggerEngine {
  const logLevelN: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  const shouldLogMessageOfLevel = (messageLogLevel: LogLevel): boolean => (logLevel === null ? false : logLevelN[messageLogLevel] >= logLevelN[logLevel])

  const getLogFunction = (level: LogLevel): ((message: string) => void) => {
    switch (level) {
      case 'debug':
        return (message) => console.debug(message)
      case 'info':
        return (message) => console.info(message)
      case 'warn':
        return (message) => console.warn(message)
      case 'error':
        return (message) => console.error(message)
    }
  }

  return {
    log: (level, message) => {
      if (shouldLogMessageOfLevel(level)) {
        getLogFunction(level)(message)
      }
    },
  }
}
