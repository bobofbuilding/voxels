import { EventOfType, EventPayloadOfType, Event, EventType } from './Event'

export function encode(ev: Event): [type: EventType, payload: string] {
  return [ev.type, JSON.stringify(ev.payload)]
}

export type EventDecodeResult<Type extends EventType> = EventDecodeResult.Success<Type> | EventDecodeResult.Error

export namespace EventDecodeResult {
  export type Success<Type extends EventType> = DecodeResult.Success<EventOfType<Type>>

  export type Error = DecodeResult.Error
}

export type EventDecoder<Type extends EventType> = Decoder<unknown, EventOfType<Type>>

export function makeDecode<Type extends EventType>(type: Type): EventDecoder<Type> {
  // This is some nasty casting but it's safe. TypeScript has some heavy blindspots when switching on a generic
  // parameter - even if we know exactly what that parameter is (it's a string literal!).
  const decodeEventWith =
    <Type0 extends EventType>(type: Type0, f: Decoder<string, EventPayloadOfType<Type0>>): Decoder<string, EventOfType<Type>> =>
    (payload) =>
      ({
        type: 'success',
        decoding: {
          type,
          payload: f(payload),
        },
      }) as unknown as EventDecodeResult<Type>

  // TODO: Validation
  switch (type) {
    case 'user/suspended':
      return fromStringPayload(decodeEventWith<'user/suspended'>(type, (payload) => JSON.parse(payload)))
    case 'user/costumeChanged':
      return fromStringPayload(decodeEventWith<'user/costumeChanged'>(type, (payload) => JSON.parse(payload)))
    case 'parcel/patched':
      return fromStringPayload(decodeEventWith<'parcel/patched'>(type, (payload) => JSON.parse(payload)))
    case 'parcel/statePatched':
      return fromStringPayload(decodeEventWith<'parcel/statePatched'>(type, (payload) => JSON.parse(payload)))
    default: {
      const n: never = type as never
      throw new Error(`Unhandled type: ${n}`)
    }
  }
}

type DecodeResult<Decoding> = DecodeResult.Success<Decoding> | DecodeResult.Error

namespace DecodeResult {
  export type Success<Decoding> = {
    type: 'success'
    decoding: Decoding
  }

  export type Error = {
    type: 'error'
    message: string
  }
}

type Decoder<Encoding, Decoding> = (encoding: Encoding) => DecodeResult<Decoding>

const fromStringPayload =
  <Type extends EventType>(f: Decoder<string, EventOfType<Type>>): Decoder<unknown, EventOfType<Type>> =>
  (payload) =>
    typeof payload === 'string' ? f(payload) : { type: 'error', message: 'payload must be typeof string' }
