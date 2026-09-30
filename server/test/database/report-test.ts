import { beforeEach, expect, test } from 'vitest'
import Report from '../../report'
import db from '../../pg'

beforeEach(() => db.query('test/reset-reports', 'TRUNCATE reports RESTART IDENTITY'))

test('reports can be created, resolved, and removed with current required fields', async () => {
  const report = new Report({ type: 'parcel', author: '0xABC', reported_id: '670', reason: 'test report' })
  expect(await report.create()).toEqual({ success: true })
  const saved = await Report.loadFromId(report.id)
  expect(saved?.author).toBe('0xabc')
  expect(saved?.resolved).toBe(false)
  saved!.resolved = true
  expect(await saved!.update()).toEqual({ success: true })
  expect((await Report.loadFromId(report.id))?.resolved).toBe(true)
  expect(await saved!.remove()).toEqual({ success: true })
  expect(await Report.loadFromId(report.id)).toBeNull()
})
