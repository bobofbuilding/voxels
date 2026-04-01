export function truncate(str: string, maxLength = 40) {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength) + '...'
}
