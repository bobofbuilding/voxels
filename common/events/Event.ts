export type Event = UserEvent | ParcelEvent

export type EventType = Event['type']

export type EventPayload = Event['payload']

export type EventOfType<TEventType extends EventType> = Extract<Event, { type: TEventType }>

export type EventPayloadOfType<TEventType extends EventType> = EventOfType<TEventType>['payload']

type AbstractEvent<Type extends string, Payload> = {
  type: Type
  payload: Payload
}

export type UserEvent = UserEvent.UserSuspendedEvent | UserEvent.UserCostumeChangedEvent

export namespace UserEvent {
  type AbstractUserEvent<Type extends string, Payload> = AbstractEvent<`user/${Type}`, Payload>

  export type UserSuspendedEvent = AbstractUserEvent<
    'suspended',
    {
      wallet: string
    }
  >

  export type UserCostumeChangedEvent = AbstractUserEvent<
    'costumeChanged',
    {
      wallet: string
    }
  >
}

export type ParcelEvent = ParcelEvent.ParcelPatchedEvent | ParcelEvent.ParcelStatePatchedEvent

export namespace ParcelEvent {
  type AbstractParcelEvent<Type extends string, Payload> = AbstractEvent<`parcel/${Type}`, Payload>

  export type ParcelPatchedEvent = AbstractParcelEvent<
    'patched',
    {
      parcelId: number
    }
  >

  export type ParcelStatePatchedEvent = AbstractParcelEvent<
    'statePatched',
    {
      parcelId: number
    }
  >
}
