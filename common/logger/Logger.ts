import { v4 as uuid } from 'uuid'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogMeta<MetaKey extends string = string> = Record<MetaKey, unknown>

export type LoggerEngine = {
  log(level: LogLevel, message: string, meta: Record<string, unknown>): void
}

export type InferMessageMetaKeys<Message extends string> = Message extends `${infer _}\$\{${infer Variable}\}${infer MessageTail}` ? Variable | InferMessageMetaKeys<MessageTail> : never

export type InferMessageMeta<Message extends string> = Record<InferMessageMetaKeys<Message>, unknown>

export type LogMetaArg<Message extends string, Meta extends LogMeta<InferMessageMetaKeys<Message>>> = keyof Meta extends never ? [meta?: LogMeta] : [meta: Meta]

export type Logger = {
  /**
   * Logs a debug message.
   *
   * Interpolation symbols can be included in messages, and will be replaced in the final message.
   *
   * For example: `logger.debug('Response received in {durationMs}ms', { durationMs })`
   * @param message The log message.
   * @param meta The metadata to send with the log message. Will be used to replace interpolation symbols.
   */
  debug<Message extends string, Meta extends InferMessageMeta<Message>>(message: Message, ...meta: LogMetaArg<Message, Meta>): void
  /**
   * Logs an info message.
   *
   * Interpolation symbols can be included in messages, and will be replaced in the final message.
   *
   * For example: `logger.info('Response received in {durationMs}ms', { durationMs })`
   * @param message The log message.
   * @param meta The metadata to send with the log message. Will be used to replace interpolation symbols.
   */
  info<Message extends string, Meta extends InferMessageMeta<Message>>(message: Message, ...meta: LogMetaArg<Message, Meta>): void
  /**
   * Logs a warning message.
   *
   * Interpolation symbols can be included in messages, and will be replaced in the final message.
   *
   * For example: `logger.warn('Response received in {durationMs}ms', { durationMs })`
   * @param message The log message.
   * @param meta The metadata to send with the log message. Will be used to replace interpolation symbols.
   */
  warn<Message extends string, Meta extends InferMessageMeta<Message>>(message: Message, ...meta: LogMetaArg<Message, Meta>): void
  /**
   * Logs an error message. Note, for logging errors in catch statements, use `logger.thrown`.
   *
   * Interpolation symbols can be included in messages, and will be replaced in the final message.
   *
   * For example: `logger.error('Response received in {durationMs}ms', { durationMs })`
   * @param message The log message.
   * @param meta The metadata to send with the log message. Will be used to replace interpolation symbols.
   */
  error<Message extends string, Meta extends InferMessageMeta<Message>>(message: Message, ...meta: LogMetaArg<Message, Meta>): void
  /**
   * Logs a thrown error. Errors have the `unknown` type in TypeScript, meaning they don't obviously contain appropriate diagnostics. This method handles resolving information consistently and appropriately.
   *
   * @param error The thrown error. The stack and message will be extracted and added to the final metadata, if possible.
   * @param message The log message explaining why the error was thrown.
   * @param meta The metadata to send with the log message. Will be used to replace interpolation symbols.
   */
  thrown<Message extends string, Meta extends InferMessageMeta<Message>>(error: unknown, message: Message, ...meta: LogMetaArg<Message, Meta>): void
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Logger {
  /**
   * Extends a logger with some extra meta. Doesn't modify the given logger.
   * @param logger The logger to extend
   * @param meta The meta to inject into the resultant logger
   */
  export function extend(logger: Logger, meta: LogMeta): Logger
  /**
   * Extends a logger with a message prefix and some extra meta. Doesn't modify the given logger.
   * @param logger The logger to extend
   * @param messagePrefix The message prefix
   * @param meta The meta to inject into the resultant logger
   */
  export function extend<MessagePrefix extends string, Meta extends InferMessageMeta<MessagePrefix>>(logger: Logger, messagePrefix: MessagePrefix, meta: Meta): Logger
  export function extend(logger: Logger, ...otherArgs: [messagePrefix: string, meta: LogMeta] | [meta: LogMeta]): Logger {
    const messagePrefix = otherArgs.length === 2 ? otherArgs[0] : ''
    const meta = otherArgs.length === 2 ? otherArgs[1] : otherArgs[0]

    const prepareForInnerLogger = (message: string, invocationMeta: LogMeta | undefined): [preparedMessage: string, preparedMeta: LogMeta] => {
      const preparedMeta = { ...meta, ...(invocationMeta || {}) }
      return [messagePrefix + message, preparedMeta]
    }

    return {
      debug: (message, ...[meta]) => logger.debug(...prepareForInnerLogger(message, meta)),
      info: (message, ...[meta]) => logger.info(...prepareForInnerLogger(message, meta)),
      warn: (message, ...[meta]) => logger.warn(...prepareForInnerLogger(message, meta)),
      error: (message, ...[meta]) => logger.error(...prepareForInnerLogger(message, meta)),
      thrown: (error, message, ...[meta]) => logger.thrown(error, ...prepareForInnerLogger(message, meta)),
    }
  }

  /**
   * Extends a logger with a correlation id. Useful for correlating calls between different components.
   * @param logger The logger to add the correlation id to.
   */
  export function addCorrelationId(logger: Logger): Logger {
    return extend(logger, { correlationId: uuid() })
  }

  export function runInterpolation(message: string, meta: LogMeta): string {
    for (const [key, value] of Object.entries(meta)) {
      while (true) {
        const previousMessage = message
        message = message.replace('${' + key + '}', value as any)
        if (previousMessage === message) break
      }
    }
    return message
  }
}
