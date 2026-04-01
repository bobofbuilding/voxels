import * as events from 'events'

/**
 * Helper type to ensure that the underlying EventEmitter is only called with a `string`/`symbol` (event names of type
 * `number` are not supported by NodeJS EventEmitters).
 */
type EventNameFrom<EventMap extends Record<string | symbol, any>> = keyof EventMap & (string | symbol)

/**
 * An EventEmitter with sound types.
 */
export type EventEmitter<EventMap extends Record<string | symbol, any>> = {
  on<EventName extends EventNameFrom<EventMap>>(
    eventName: EventName,
    listener: (eventData: EventMap[EventName]) => void,
  ): void
  off<EventName extends EventNameFrom<EventMap>>(
    eventName: EventName,
    listener: (eventData: EventMap[EventName]) => void,
  ): void
  once<EventName extends EventNameFrom<EventMap>>(
    eventName: EventName,
    listener: (eventData: EventMap[EventName]) => void,
  ): void
  emit<EventName extends EventNameFrom<EventMap>>(eventName: EventName, eventData: EventMap[EventName]): void
}

export function createEventEmitter<EventMap extends Record<string | symbol, any>>(
  onError: (error: any) => void,
  abortSignal: AbortSignal,
): EventEmitter<EventMap> {
  const eventEmitter = new events.EventEmitter({ captureRejections: true })

  eventEmitter.addListener('error', onError)

  abortSignal.addEventListener('abort', () => eventEmitter.removeAllListeners(), { once: true })

  return eventEmitter
}

export type ReadonlyEventEmitter<E extends EventEmitter<any>> = Pick<E, 'on' | 'off' | 'once'>
