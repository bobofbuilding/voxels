export function linearInterpolate(x1: number, y1: number, x2: number, y2: number) {
  return (x: number): number => {
    return y1 + (x - x1) * ((y2 - y1) / (x2 - x1))
  }
}
