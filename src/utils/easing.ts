// sine ease based on percentage of transition (e.g. if 50% of transition, ease 50% of the way)
export function easeInSineDistance(transitionPercentage: number) {
  return -1 * Math.cos(transitionPercentage * (Math.PI / 2)) + 1
}
