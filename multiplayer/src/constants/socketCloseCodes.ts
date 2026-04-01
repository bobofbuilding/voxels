export const WSCloseCodes = {
  normalClosure: 1000,
  unsupportedData: 1003,
  abnormalClosure: 1006,
  validationError: 1008,
  internalError: 1011,
  restarting: 1012,
  tryAgainLater: 1013,
  loginAttemptRateLimited: 4000,
  shardClientCapacityMet: 4001,
} as const

export type WSCloseCode = (typeof WSCloseCodes)[keyof typeof WSCloseCodes]
