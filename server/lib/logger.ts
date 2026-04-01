import winston from 'winston'

// by default all logs in local dev or if the env var DEBUG=true is set, otherwise we'll exclude debug logs

const logLevel = process.env.DEBUG_LOG === 'true' ? 'debug' : 'info'

// ship logs to the console output (stdout)
const consoleTransport = new winston.transports.Console()

const log = winston.createLogger({
  level: logLevel,
  exitOnError: false,
  transports: [consoleTransport],
})
export default log

// create a labeled and named logger with a prefix
export const named = (label: string) => {
  return winston.createLogger({
    level: logLevel,
    exitOnError: false,
    transports: [new winston.transports.Console()],
  })
}
