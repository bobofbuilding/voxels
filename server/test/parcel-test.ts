import test from 'tape'
import Parcel from '../parcel'

test('parcel#ctor', (t) => {
  const p = new Parcel({ id: 42 })
  t.ok(p)
  t.equal(p.id, 42)
  t.end()
})

test('parcel#getFeaturesByType', (t) => {
  const features = [{ type: 'boop' }, { type: 'boop' }, { type: 'zing' }]
  const p = new Parcel({ content: { features } })
  t.equal(p.getFeaturesByType('boop' as any).length, 2)
  t.equal(p.getFeaturesByType('zing' as any).length, 1)
  t.equal(p.getFeaturesByType('sbaerbva' as any).length, 0)
  t.end()
})

test('parcel#summary', (t) => {
  const p = new Parcel({})
  t.equal(typeof p.summary, 'object')
  t.end()
})

test('parcel#setContent', (t) => {
  const p = new Parcel({})
  p.setContent({ voxels: 'boop', features: ['herp', 'derp'] })
  t.ok(p.content.voxels)
  t.end()
})

test('parcel#queryContract', (t) => {
  // todo
  t.end()
})

test('parcel#insertJob', (t) => {
  // todo
  t.end()
})

test('parcel#reload', (t) => {
  // todo
  t.end()
})

test('parcel#load', (t) => {
  // todo
  t.end()
})

test('parcel#loadAll', (t) => {
  // todo
  t.end()
})

test('parcel#save', (t) => {
  // todo
  t.end()
})
