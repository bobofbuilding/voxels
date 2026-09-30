import { strict as assert } from 'node:assert'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import * as messages from '../../common/messages'

const base = process.argv[2] || 'ws://127.0.0.1:8787/socket'
const clients: WebSocket[] = []
async function connect(id = randomUUID()): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base}?client_uuid=${id}`)
    clients.push(ws)
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}
function exchange(ws: WebSocket, outgoing: messages.Message, expected: messages.MessageType) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`No response ${expected}`)), 8000)
    const handler = (data: WebSocket.RawData) => {
      const decoded = messages.decode(data)
      if (decoded.type === 'success' && decoded.message.type === expected) {
        clearTimeout(timer)
        ws.off('message', handler)
        resolve()
      }
    }
    ws.on('message', handler)
    ws.send(messages.encode(outgoing))
  })
}
async function run() {
  const id = randomUUID()
  const first = await connect(id)
  const second = await connect()
  for (const ws of [first, second]) {
    await exchange(ws, { type: messages.MessageType.anon }, messages.MessageType.loginComplete)
    await exchange(ws, { type: messages.MessageType.ping }, messages.MessageType.pong)
  }
  await assert.rejects(connect(id), /403/)
  console.log('PASS: two guest sessions, protocol ping/pong, duplicate ID rejected')
}
const deadline = setTimeout(() => {
  console.error('Smoke test deadline')
  process.exit(1)
}, 20000)
run()
  .catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
  .finally(() => {
    clearTimeout(deadline)
    for (const ws of clients) ws.terminate()
  })
