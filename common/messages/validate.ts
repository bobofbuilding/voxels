import { isLeft } from 'fp-ts/lib/Either'
import { Type } from 'io-ts'
import { PathReporter } from 'io-ts/lib/PathReporter'

/**
 * Validate that a fetch response conforms to a message type, returning an object of that type
 * Failures will throw warnings but still coerce the result to that type. This can be tightened up when we have
 * more confidence in the validity of the database content
 */
export function validateMessageResponse<MessageType>(ioType: Type<MessageType, unknown, unknown>): (response: Response) => Promise<MessageType> {
  return (response: Response) => {
    if ('ok' in response && !response.ok) {
      return Promise.reject(response)
    }
    return response.json()
  }
}

export function validateMessageString<MessageType>(ioType: Type<MessageType, unknown, unknown>, text: string) {
  return validateMessageData(ioType, JSON.parse(text))
}

function validateMessageData<MessageType>(ioType: Type<MessageType, unknown, unknown>, data: unknown) {
  const result = ioType.decode(data)

  if (isLeft(result)) {
    const errors = PathReporter.report(result)
    console.warn(`validation error in ${ioType.name} ${errors.length} errors`, data)
    errors.forEach((x) => console.debug(x))
  }
  return data as MessageType
}
/**
 * Does the same as validateMessageData, but returns null if invalid
 * @returns
 */
export function validateMessageDataHarsh<MessageType>(ioType: Type<MessageType, unknown, unknown>, data: unknown) {
  const result = ioType.decode(data)
  if (isLeft(result)) {
    const errors = PathReporter.report(result)
    console.warn(`validation error in ${ioType.name} ${errors.length} errors`, data)
    errors.forEach((x) => console.warn(x))
    return null
  }
  return data as MessageType
}
