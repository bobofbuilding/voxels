import test from 'tape'
import Avatar from '../avatar'

const DAY = 24 * 60 * 60 * 1000

test('Avatar#getSuspended-none', async (t) => {
  const result = await Avatar.getSuspended('non-existent')
  t.notOk(result)
  t.end()
})

test('Avatar#suspend', async (t) => {
  const response = await Avatar.suspend('a', 'test', 30)
  t.ok(response)
  t.equal(response.wallet, 'a')
  t.equal(response.reason, 'test')
  t.end()
})

test('Avatar#getSuspended', async (t) => {
  // setup
  await Avatar.suspend('b', 'test', 7)

  const sixDaysFromNow = new Date(Date.now() + 6 * DAY)
  const eightDaysFromNow = new Date(Date.now() + 8 * DAY)

  const response = await Avatar.getSuspended('b')
  t.ok(response, 'Is object')
  t.ok(response!.expires_at instanceof Date, 'is a date')
  t.ok(response!.expires_at > sixDaysFromNow && response!.expires_at < eightDaysFromNow, 'expires 7 days from now')
  t.equal(response!.reason, 'test')
  t.end()
})

test('Avatar#unsuspend', async (t) => {
  // setup
  await Avatar.suspend('c', 'test', 7)

  const response = await Avatar.unsuspend('c')
  t.ok(response, 'Unsuspend successful')
  t.true(checkPast(response.expires_at), 'expires at is in the past')

  // check to make sure the user really has been unsuspended
  const check = await Avatar.getSuspended('c')
  t.notOk(check)

  t.end()
})

function checkPast(date: any) {
  // add 1 minute to current time to ensure matching db time
  return new Date(date) < new Date(Date.now() + 60e3)
}
