interface BroadcastInfo {
  id: string
  streamUrl: string
}

export class AudioBroadcaster {
  node: AudioNode
  recorder: MediaRecorder | null = null
  enabled = true
  onError: (err: Error) => void
  _reject: ((any: any) => void) | null = null
  socket: WebSocket | null = null

  constructor(node: AudioNode, onError: (err: Error) => void) {
    this.node = node
    this.onError = onError
  }

  handleError(err: any) {
    this.stop()

    if (this._reject) {
      this._reject(err)
      this._reject = null
    } else {
      this.onError && this.onError(err)
    }
  }

  start(): Promise<BroadcastInfo> {
    const mimeType = 'audio/webm;codecs="opus"'
    const audioContext = this.node.context as AudioContext
    const endpoint = process.env.BROADCAST_URL || 'wss://broadcast.cryptovoxels.com/broadcast'

    return new Promise((resolve, reject) => {
      if (!this.enabled) {
        return this.handleError(new Error('Boomboxes are currently unavailable.'))
      }

      this._reject = reject
      const MediaRecorder = window['MediaRecorder']
      if (!MediaRecorder) return reject(new Error('MediaRecorder not available'))
      const socket = new window.WebSocket(endpoint)
      if (this.socket) {
        this.socket.close()
        this.socket = null
      }
      this.socket = socket

      socket.onopen = () => {
        const destination = audioContext.createMediaStreamDestination()
        this.node.connect(destination)

        this.recorder = new MediaRecorder(destination.stream, { audioBitsPerSecond: 64000, mimeType })
        this.recorder.start(10)
        this.recorder.ondataavailable = (e: any) => {
          socket.send(e.data)
        }
        this.recorder.onstop = () => {
          this.node.disconnect(destination)
        }

        this.recorder.onerror = (e: any) => {
          this.handleError(e.error)
        }
      }
      socket.onclose = () => {
        this.handleError(new Error('Broadcast stream closed unexpectedly'))
      }
      socket.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.error) {
          this.handleError(new Error(msg.error))
        } else if (msg.started) {
          // this shouldn't happen more than once, but lets be safe!
          if (this._reject) {
            this._reject = null
            resolve(msg.info as BroadcastInfo)
          }
        }
      }
    })
  }

  stop() {
    this.recorder && this.recorder.stop()
    this.recorder = null
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }
}
