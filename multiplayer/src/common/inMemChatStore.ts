import { ChatMessage } from '../../../common/messages'
import { ChatStore } from './chatStore'

const REMOVE_OLD_MESSAGES_INTERVAL = 1000 * 60 // 1 minute
// no persistance, just in memory for the lifetime of the server instance..
export class InMemoryChatStore implements ChatStore {
  persistanceTime: number
  intervalHandle: NodeJS.Timeout | null = null

  readonly messages: { ts: number; m: ChatMessage }[] = []
  constructor(persistanceTime: number) {
    this.persistanceTime = persistanceTime
    if (isFinite(persistanceTime)) {
      this.intervalHandle = setInterval(() => this.removeOldMessages(persistanceTime), REMOVE_OLD_MESSAGES_INTERVAL)
    }
  }

  store(message: ChatMessage): Promise<void> {
    this.messages.push({ ts: Date.now(), m: message })
    return Promise.resolve()
  }

  get(limit: number): Promise<{ ts: number; m: ChatMessage }[]> {
    return Promise.resolve(this.messages.length > limit ? this.messages.slice(-limit) : this.messages)
  }

  dispose(): Promise<void> {
    if (this.intervalHandle) clearInterval(this.intervalHandle)
    this.messages.length = 0
    return Promise.resolve()
  }

  private removeOldMessages(persistanceTime: number): void {
    const expiry = Date.now() - persistanceTime
    // the messages are in order of arrival, so we can just remove the first ones
    while (this.messages.length && this.messages[0].ts < expiry) {
      this.messages.shift()
    }
  }
}
