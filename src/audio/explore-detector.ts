export class ExploreDetector {
  frames: Array<boolean>
  index: number
  threshold: number

  constructor(frames: number, threshold: number) {
    this.frames = new Array(frames)
    this.threshold = threshold
    this.index = 0
  }

  addFrame(condition: any) {
    this.frames[this.index] = condition
    this.index = (this.index + 1) % this.frames.length
  }

  isTriggered() {
    return this.frames.filter((f) => f).length > this.threshold
  }

  reset() {
    for (let i = 0; i < this.frames.length; i++) {
      this.frames[i] = false
    }
  }
}
