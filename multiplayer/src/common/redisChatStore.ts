import { RedisClientType } from 'redis'
import { ChatMessage } from '../../../common/messages'
import { ChatStore } from './chatStore'

async function removeOldMessages(client: RedisClientType, key: string, persistanceTime: number) {
  const expiry = Date.now() - persistanceTime
  const removed = await client.zRemRangeByScore(key, '-inf', expiry)
  if (removed > 0) {
    console.info(`Removed ${removed} old chat messages from ${key}`)
  }
}
// 1 minute + JITTER
const REMOVE_OLD_MESSAGES_INTERVAL = 1000 * 60 + Math.random() * 1000 * 60

export class RedisChatStore implements ChatStore {
  private intervalHandle: NodeJS.Timeout | null = null
  constructor(
    private readonly client: RedisClientType,
    readonly persistanceTime: number,
    private readonly key: string,
  ) {
    if (isFinite(persistanceTime)) {
      this.intervalHandle = setInterval(
        () => removeOldMessages(client, key, persistanceTime),
        REMOVE_OLD_MESSAGES_INTERVAL,
      )
    }
  }

  async store(message: ChatMessage): Promise<void> {
    await this.client.zAdd(this.key, [{ value: JSON.stringify(message), score: Date.now() }])
  }

  async get(limit: number): Promise<{ ts: number; m: ChatMessage }[]> {
    const minTime = Date.now() - this.persistanceTime
    // a shame that this is not an iterator for streaming support, but ah well
    // when REV is true, the order is reversed so we have to swap min and max time
    const messages = await this.client.zRangeWithScores(this.key, 'inf', minTime, {
      BY: 'SCORE',
      REV: true,
      LIMIT: {
        offset: 0,
        count: limit,
      },
    })
    return messages.map(({ score, value }) => ({ ts: score, m: JSON.parse(value) as ChatMessage }))
  }

  dispose(): Promise<void> {
    if (this.intervalHandle) clearInterval(this.intervalHandle)

    return Promise.resolve()
  }
}

export const createGlobalChatStore = (client: RedisClientType, persistanceTime: number) =>
  new RedisChatStore(client, persistanceTime, 'globalChat')
