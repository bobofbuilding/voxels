import { ChatMessage } from '../../../common/messages'

export type ChatStore = {
  readonly persistanceTime: number
  store(message: ChatMessage): Promise<void>
  get(limit: number): Promise<{ ts: number; m: ChatMessage }[]>
  dispose(): Promise<void>
}
