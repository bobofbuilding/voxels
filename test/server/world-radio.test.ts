// @vitest-environment node
import { expect, test } from 'vitest'
import { buildSchedule } from '../../server/lib/radio'
import { existsSync } from 'node:fs'

test('world radio covers a complete day with locally hosted original music and no external announcements', () => {
  const schedule = buildSchedule(20726)
  expect(schedule.musicUri).toBe('/music')
  expect(schedule.spots).toEqual([])
  let end = schedule.segments[0].startsAt
  expect(end).toBeLessThanOrEqual(0)
  for (const segment of schedule.segments) {
    expect(segment.startsAt).toBe(end)
    expect(segment.duration).toBeGreaterThan(0)
    expect(existsSync(`dist/music/${segment.fileName}`)).toBe(true)
    end += segment.duration
  }
  expect(end).toBeGreaterThanOrEqual(schedule.daySeconds)
  expect(buildSchedule(20726)).toEqual(schedule)
})

test('eight different tracks play for 42m40s before repeating, including across midnight', () => {
  const schedule = buildSchedule(20726)
  expect(new Set(schedule.segments.slice(0, 8).map((s) => s.fileName)).size).toBe(8)
  expect(schedule.segments[8].fileName).toBe(schedule.segments[0].fileName)
  expect(schedule.segments[8].startsAt - schedule.segments[0].startsAt).toBe(2560)
  const last = schedule.segments.at(-1)!
  const next = buildSchedule(20727).segments[0]
  if (last.startsAt + last.duration > 86400) {
    expect(next.fileName).toBe(last.fileName)
    expect(next.startsAt + 86400).toBe(last.startsAt)
  } else {
    const order = schedule.segments.slice(0, 8).map((s) => s.fileName)
    expect(next.fileName).toBe(order[(order.indexOf(last.fileName) + 1) % order.length])
    expect(next.startsAt).toBeCloseTo(0)
  }
})
