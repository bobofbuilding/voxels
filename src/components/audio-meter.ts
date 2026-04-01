export interface AudioMeter extends ScriptProcessorNode {
  clipping: boolean
  lastClip: number
  volume: number[]
  peak: number[]
  clipLevel: number
  averaging: number
  clipLag: number
  watch: (listener: (l: number, r: number, clipping: boolean) => void) => () => void
  checkClipping: () => boolean
  dispose: () => void
}

export function createAudioMeter(audioContext: AudioContext, clipLevel = 1, averaging = 0.95, clipLag = 200) {
  const processor = audioContext.createScriptProcessor(1024, 2) as AudioMeter
  processor.onaudioprocess = volumeAudioProcess as (this: ScriptProcessorNode, ev: AudioProcessingEvent) => any
  processor.clipping = false
  processor.lastClip = 0
  processor.volume = [0, 0]
  processor.peak = [0, 0]
  processor.clipLevel = clipLevel
  processor.averaging = averaging
  processor.clipLag = clipLag

  processor.connect(audioContext.destination)

  processor.watch = function (listener) {
    let handle: number | null = null
    let removed = false
    const renderLoop = () => {
      if (!this.onaudioprocess || removed) return // check if disposed
      listener(processor.volume[0], processor.volume[1], processor.checkClipping())
      handle = requestAnimationFrame(renderLoop)
    }

    renderLoop()

    return () => {
      removed = true
      handle && cancelAnimationFrame(handle)
    }
  }

  processor.checkClipping = function () {
    if (!this.clipping) return false
    if (this.lastClip + this.clipLag < window.performance.now()) this.clipping = false
    return this.clipping
  }

  processor.dispose = function () {
    this.disconnect()
    this.onaudioprocess = null
  }

  return processor
}

function volumeAudioProcess(this: AudioMeter, event: AudioProcessingEvent) {
  const bufL = event.inputBuffer.getChannelData(0)
  const bufR = event.inputBuffer.getChannelData(1) || bufL

  const bufLength = bufL.length
  let sumL = 0
  let sumR = 0
  let l, r

  for (let i = 0; i < bufLength; i++) {
    l = bufL[i]
    r = bufR[i]
    if (Math.abs(l) >= this.clipLevel || Math.abs(r) >= this.clipLevel) {
      this.clipping = true
      this.lastClip = window.performance.now()
    }
    sumL += l * l
    sumR += r * r
  }

  const rmsL = Math.sqrt(sumL / bufLength) * 2
  const rmsR = Math.sqrt(sumR / bufLength) * 2
  this.volume[0] = Math.max(this.volume[0] * this.averaging, Math.pow(rmsL, 1 / 2))
  this.volume[1] = Math.max(this.volume[1] * this.averaging, Math.pow(rmsR, 1 / 2))
}
