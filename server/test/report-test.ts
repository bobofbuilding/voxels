import test from 'tape'
import ModerationReport from '../report'

test('Reports#object', (t) => {
  const object = new ModerationReport({ id: 42, author: 'abc', reported_id: 10, reason: 'cleaned the toilet' })
  t.ok(object)
  t.equal(object.reason, 'cleaned the toilet')
  t.end()
})

test('Reports#DoesNotExist', async (t) => {
  const object = await ModerationReport.loadFromId(42)
  t.notOk(object)
  t.end()
})

test('Reports#Create', async (t) => {
  const p = new ModerationReport({ author: 'abc', reported_id: 10, reason: 'cleaned the toilet' })
  const response = await p.create()
  t.ok(response)
  t.true(response.success)
  t.end()
})

test('Reports#IsNotResolved', async (t) => {
  const object = await ModerationReport.loadFromId(1)
  t.ok(object)
  t.equal(object?.reason, 'cleaned the toilet')
  t.equal(object?.author, 'abc')
  t.equal(object?.resolved, false)
  t.end()
})

test('Reports#Update', async (t) => {
  const object = await ModerationReport.loadFromId(1)
  t.ok(object)
  if (object) {
    object.resolved = true
  }
  const response = await object?.update()
  t.ok(response)
  t.ok(response?.success)
  t.end()
})

test('Reports#IsNotResolved', async (t) => {
  const object = await ModerationReport.loadFromId(1)
  t.ok(object)
  t.equal(object?.reason, 'cleaned the toilet')
  t.equal(object?.author, 'abc')
  t.equal(object?.resolved, true)
  t.end()
})

test('Reports#Remove', async (t) => {
  const object = await ModerationReport.loadFromId(1)
  t.ok(object)
  const response = await object?.remove()
  t.ok(response)
  t.ok(response?.success)
  t.end()
})

test('Reports#Deleted', async (t) => {
  const object = await ModerationReport.loadFromId(1)
  t.notOk(object)
  t.end()
})
