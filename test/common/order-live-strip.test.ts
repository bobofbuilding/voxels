import { describe, it, expect } from 'vitest'
import { orderLiveStrip } from '../../common/helpers/utils'

describe('orderLiveStrip', () => {
  it('sorts by viewers when two or fewer streams', () => {
    const r = orderLiveStrip([
      { room: 'a', viewers: 2 },
      { room: 'b', viewers: 9 },
    ])
    expect(r.map((e) => e.room)).toEqual(['b', 'a'])
  })

  it('puts the biggest room first when many streams', () => {
    const r = orderLiveStrip([
      { room: 'small', viewers: 1 },
      { room: 'big', viewers: 50 },
      { room: 'mid', viewers: 10 },
      { room: 'tiny', viewers: 2 },
    ])
    expect(r[0].room).toBe('big')
    expect(r.length).toBe(4)
  })
})
