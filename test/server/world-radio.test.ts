// @vitest-environment node
import { expect, test } from 'vitest'
import { buildSchedule } from '../../server/lib/radio'
import { existsSync } from 'node:fs'

test('world radio covers a complete day with locally hosted original music and no external announcements', () => {
  const schedule = buildSchedule(20726)
  expect(schedule.musicUri).toBe('/music')
  expect(schedule.spots).toEqual([])
  let end = 0
  for (const segment of schedule.segments) {
    expect(segment.startsAt).toBe(end)
    expect(segment.duration).toBeGreaterThan(0)
    expect(existsSync(`dist/music/${segment.fileName}`)).toBe(true)
    end += segment.duration
  }
  expect(end).toBeGreaterThanOrEqual(schedule.daySeconds)
  expect(buildSchedule(20726)).toEqual(schedule)
})
