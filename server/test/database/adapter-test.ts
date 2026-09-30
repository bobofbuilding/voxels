import { expect, test } from 'vitest'
import db from '../../pg'

test('reusing a query config leaves the caller object unchanged', async () => {
  const query = { text: 'SELECT $1::integer AS value', values: [7] }
  expect((await db.query(query)).rows[0].value).toBe(7)
  expect((await db.query(query)).rows[0].value).toBe(7)
  expect(query.text).toBe('SELECT $1::integer AS value')
})

test('maintenance timeouts are local to the borrowed transaction', async () => {
  const client = await db.connect()
  try {
    const before = await client.query('SHOW statement_timeout')
    await client.query('BEGIN')
    await client.query("SET LOCAL statement_timeout = '30s'")
    expect((await db.query('test/transaction', 'SELECT 1 AS value', [], client)).rows[0].value).toBe(1)
    await client.query('COMMIT')
    expect((await client.query('SHOW statement_timeout')).rows).toEqual(before.rows)
  } finally {
    client.release()
  }
})
