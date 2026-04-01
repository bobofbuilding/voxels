import winston from 'winston'
// const LogDNATransport = require('logdna-winston')

export const HEALTHCHECK_URL = '/zhealth'

function inDebugMode() {
  return process.env.DEBUG_LOG !== 'false'
}

// by default all logs unless ENV variable DEBUG=false is set
// const logLevel = inDebugMode() ? 'debug' : 'info'

// const prettyFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
//   const ts = timestamp?.split('T')[1]?.split('.')[0] // "02:03:59"
//   const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''

//   return `[${level.padEnd(5)}] ${ts} ${message} ${metaStr}`
// })

const doFormat = winston.format.printf(({ level, message, timestamp }) => {
  const ts = (timestamp as string).split('T')[1].split('.')[0] // HH:mm:ss
  const lvl = level.toUpperCase().padEnd(5)
  return `${ts} ${lvl} ${message}`
})

export const createLogger = (appName?: string, label?: string): winston.Logger => {
  return winston.createLogger({
    level: 'debug',
    exitOnError: false,

    // this makes winston dump errors to console too
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), doFormat),

    transports: [new winston.transports.Console()],

    exceptionHandlers: [new winston.transports.Console({ stderrLevels: ['error'] })],

    rejectionHandlers: [new winston.transports.Console({ stderrLevels: ['error'] })],
  })
}
