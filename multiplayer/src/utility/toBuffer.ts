export function toBuffer(data: ArrayBuffer | Buffer | ArrayBufferView): Buffer {
  if (Buffer.isBuffer(data)) return data

  // The ArrayBuffer.isView() method determines whether the passed value is one of the ArrayBuffer views,
  // such as typed array objects or a DataView
  if (ArrayBuffer.isView(data)) {
    // this will capture Uint8Array etc
    // to convert an uint8array to a NodeJS Buffer,
    // use Buffer.from(arrayBuffer, offset, length) in order not to copy the underlying ArrayBuffer,
    // while Buffer.from(uint8array) copies it:
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  } else {
    // if something else fall back to buffer.from
    return Buffer.from(data)
  }
}
