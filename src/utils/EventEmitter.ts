type EventNameFrom<EventMap extends Record<string, any>> = keyof EventMap & string

/**
 * An EventTarget with types!
 */
export interface EventEmitter<EventMap extends Record<string, any>> extends EventTarget {
  addEventListener<EventName extends EventNameFrom<EventMap>>(eventName: EventName, listener: TypedEventListenerOrObject<EventName, EventMap[EventName]> | null, options?: AddEventListenerOptions | boolean): void

  removeEventListener<EventName extends EventNameFrom<EventMap>>(eventName: EventName, listener: TypedEventListenerOrObject<EventName, EventMap[EventName]> | null, options?: EventListenerOptions | boolean): void

  dispatchEvent<EventName extends EventNameFrom<EventMap>>(event: TypedEvent<EventName, EventMap[EventName]> & { type: EventName }): boolean
}

export interface TypedEvent<EventName extends string, EventData> extends CustomEvent<EventData> {
  type: EventName
}

export type TypedEventListenerObject<EventName extends string, EventData> = {
  handleEvent(object: TypedEvent<EventName, EventData>): void
}

export type TypedEventListener<EventName extends string, EventData> = (event: TypedEvent<EventName, EventData>) => void

export type TypedEventListenerOrObject<EventName extends string, EventData> = TypedEventListener<EventName, EventData> | TypedEventListenerObject<EventName, EventData>

export class TypedEventTarget<EventMap extends Record<string | symbol, any>> implements EventEmitter<EventMap> {
  // proxied event target so that it survives webpack, overriding eventTarget gets borked by webpack :(
  private delegate = new EventTarget()

  addEventListener<EventName extends EventNameFrom<EventMap>>(eventName: EventName, listener: TypedEventListenerOrObject<EventName, EventMap[EventName]> | null, options?: AddEventListenerOptions | boolean): void {
    this.delegate.addEventListener(eventName, listener as EventListenerOrEventListenerObject | null, options)
  }

  removeEventListener<EventName extends EventNameFrom<EventMap>>(eventName: EventName, listener: TypedEventListenerOrObject<EventName, EventMap[EventName]> | null, options?: EventListenerOptions | boolean): void {
    this.delegate.removeEventListener(eventName, listener as EventListenerOrEventListenerObject | null, options)
  }

  dispatchEvent<EventName extends EventNameFrom<EventMap>>(
    event: TypedEvent<EventName, EventMap[EventName]> & {
      type: EventName
    },
  ): boolean {
    return this.delegate.dispatchEvent(event)
  }
}

/** Helper to create a strongly typed event for use with a TypedEventTarget */
export const createEvent = <EventName extends string, EventData>(eventName: EventName, eventData: EventData): TypedEvent<EventName, EventData> => {
  return new CustomEvent(eventName, { detail: eventData }) as TypedEvent<EventName, EventData>
}
