export function sum(arr: any) {
  return arr.reduce((a: any, b: any) => a + b)
}

export function average(arr: any) {
  return arr.reduce((a: any, b: any) => a + b) / arr.length
}

export function calculateDifferenceTime(t: any) {
  return Math.floor(Date.now()) - Date.parse(t)
}

export function standardDeviation(array: any[]) {
  const n = array.length
  const mean = array.reduce((a, b) => a + b) / n
  return Math.sqrt(array.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}
