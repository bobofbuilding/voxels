import pluralize from 'pluralize'

export const SecondMS = 1000
export const MinuteMS = 60 * SecondMS
export const HourMS = 60 * MinuteMS
export const DayMS = 24 * HourMS
export const WeekMS = 7 * DayMS

export type Interval = { days: number; hours: number; minutes: number; seconds: number }

export function addTimeToDate(date: string, milliseconds: number) {
  let d = new Date(date).getTime()
  d += milliseconds
  return new Date(d).toString()
}

export function getTimezone(date?: Date) {
  if (date) {
    return new Date(date).getTimezoneOffset()
  } else {
    return new Date().getTimezoneOffset()
  }
}

export const isInFuture = (date: Date) => Date.now() < date.getTime()
export const isInPast = (date: Date) => Date.now() > date.getTime()
export const isLive = (start: Date, end: Date) => isInPast(start) && isInFuture(end)

export const dayOfWeek = (d: Date, short?: boolean) => d.toLocaleString('en-US', { weekday: short ? 'short' : 'long' })

export const monthOfYear = (d: Date, short?: boolean) => d.toLocaleString('en-US', { month: short ? 'short' : 'long' })

export function nth(d: number | string) {
  const v = Number(d)
  if (v > 3 && v < 21) return 'th'
  switch (v % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

export function formatToDatetime(time: number | Date): string {
  // yes, 'sv-SE' is no coincidence, it's almost the format (yyyy-mm-ddThh:mm:ss) that input['datetime-local'] wants
  // see https://dev.to/mendyberger/input-and-js-dates-2lhc
  return new Date(time)
    .toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(' ', 'T')
}

export function isToday(date: Date) {
  const today = new Date()
  return today.toDateString() === date.toDateString()
}

export function isTomorrow(date: Date) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toDateString() === date.toDateString()
}

export function diffToDuration(a: Date, b: Date): string {
  const ms = Math.abs(a.getTime() - b.getTime())
  const interval = milliSecondsToInterval(ms)
  return intervalToDuration(interval)
}

export function durationToMilliSeconds(duration: string) {
  const { days, hours, minutes, seconds } = durationToInterval(duration)
  return days * DayMS + hours * HourMS + minutes * MinuteMS + seconds * SecondMS
}

export const milliSecondsToInterval = (durationInMS: number): Interval => {
  // calculate time left
  const days = Math.floor(durationInMS / DayMS)
  const hours = Math.floor((durationInMS % DayMS) / HourMS)
  const minutes = Math.floor((durationInMS % HourMS) / MinuteMS)
  const seconds = Math.floor((durationInMS % MinuteMS) / SecondMS)
  return { days, hours, minutes, seconds }
}

export const durationToInterval = (duration: string): Interval => {
  const t = duration.split(':')
  let days = 0
  let hours = 0
  let minutes = 0
  let seconds = 0

  if (t.length === 1) {
    seconds = parseInt(t[0])
  } else if (t.length === 2) {
    minutes = parseInt(t[0])
    seconds = parseInt(t[1])
  } else if (t.length === 3) {
    hours = parseInt(t[0])
    minutes = parseInt(t[1])
    seconds = parseInt(t[2])
  } else if (t.length === 4) {
    days = parseInt(t[0])
    hours = parseInt(t[1])
    minutes = parseInt(t[2])
    seconds = parseInt(t[3])
  }
  return { days, hours, minutes, seconds }
}

export const intervalToDuration = (i: Interval) => {
  const opt = { minimumIntegerDigits: 2 }
  return `${i.days.toLocaleString(undefined, opt)}:${i.hours.toLocaleString(undefined, opt)}:${i.minutes.toLocaleString(undefined, opt)}:${i.seconds.toLocaleString(undefined, opt)}`
}

export const intervalAsString = ({ days, hours, minutes, seconds }: Interval): string => {
  const result = []
  if (days) {
    result.push(`${days} ${pluralize('day', days)}`)
  }
  if (hours) {
    result.push(`${hours} ${pluralize('hour', hours)}`)
  }
  if (minutes) {
    result.push(`${minutes} ${pluralize('minute', minutes)}`)
  }
  if (seconds) {
    result.push(`${seconds} ${pluralize('second', seconds)}`)
  }
  if (result.length === 1) {
    return result.join('')
  }
  if (result.length === 2) {
    return result.join(' and ')
  }
  if (result.length === 3) {
    return `${result[0]}, ${result[1]} and ${result[2]}`
  }
  if (result.length === 4) {
    return `${result[0]}, ${result[1]}, ${result[2]} and ${result[3]}`
  }
  return result.join(', ')
}
