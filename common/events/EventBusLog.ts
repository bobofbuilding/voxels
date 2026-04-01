import { Event, EventType } from './Event'
import { EventBus } from './EventBus'

export type EventBusLog = Partial<{
  onBeforePublish(event: Event): void
  onAfterPublish(event: Event): void
  onBeforeSubscribe(type: EventType): void
  onAfterSubscribe(type: EventType): void
  onBeforeUnsubscribe(type: EventType): void
  onAfterUnsubscribe(type: EventType): void
  onEvent(event: Event): void
}>

/**
 * Decorates an event bus with callback functions that notify when the event bus is effected. The given event bus is
 * not mutated, the function instead returns a new event bus with the log interface attached.
 * @param eventBus The event bus to decorate
 * @param log The log interface to attach to the event bus
 * @returns A new event bus with the log attached
 */
export const withLog = <TEventBus extends EventBus>(eventBus: TEventBus, log: EventBusLog): TEventBus => ({
  ...eventBus,
  publish: async (event) => {
    log.onBeforePublish && log.onBeforePublish(event)
    await eventBus.publish(event)
    log.onAfterPublish && log.onAfterPublish(event)
  },
  subscribe: async (type, listener) => {
    log.onBeforeSubscribe && log.onBeforeSubscribe(type)
    const unsubscribe = await eventBus.subscribe(type, (event) => {
      listener(event)
      log.onEvent && log.onEvent(event)
    })
    log.onAfterSubscribe && log.onAfterSubscribe(type)

    return async () => {
      log.onBeforeUnsubscribe && log.onBeforeUnsubscribe(type)
      await unsubscribe()
      log.onAfterUnsubscribe && log.onAfterUnsubscribe(type)
    }
  },
})
