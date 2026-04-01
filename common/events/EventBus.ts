import { EventOfType, EventType, Event } from './Event'

/**
 * A function that can be called to unsubscribe to the respective subscription
 */
export type UnsubscribeFunction = () => Promise<void>

/**
 * A function that is called whenever an event of the given type occurs
 */
export type EventListener<Type extends EventType> = (event: EventOfType<Type>) => void

export type EventBus = {
  /**
   * Publishes an event, so that all active subscribers will receive it.
   * @param event The event to publish
   */
  publish(event: Event): Promise<void>

  /**
   * Subscribes to a specific type of event
   * @param type The type of event to subscribe to
   * @param listener A callback that is called whenever an event of the given type is published
   * @returns A function that can be called to unsubscribe from this event
   */
  subscribe<Type extends EventType>(type: Type, listener: EventListener<Type>): Promise<UnsubscribeFunction>
}

/**
 * An stubbed implementation of the @see EventBus. May be useful for testing, or for iterative integration of the
 * event bus.
 */
export const NOOP_EVENT_BUS: EventBus = {
  publish: () => Promise.resolve(),
  subscribe: () => Promise.resolve(() => Promise.resolve()),
}
