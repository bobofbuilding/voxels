import test from 'tape'
import ParcelBuilder from '../parcel-builder'

const parcel = {
  x1: 10,
  x2: 15,
  height: 5,
  z1: 30,
  z2: 35,
}

test('ParcelBuilder#ctor', (t) => {
  const b = new ParcelBuilder(parcel)
  t.ok(b)
  t.equal(b.width, 10)
  t.equal(b.depth, 10)
  t.equal(b.height, 10)
  t.deepEqual(b.resolution, [10, 10, 10])
  t.equal(typeof b.voxels, 'string')
  t.end()
})

test('ParcelBuilder#serialize', (t) => {
  const b = new ParcelBuilder(parcel)
  t.equal(typeof b.serialize, 'object')
  t.end()
})

test('ParcelBuilder#Empty', (t) => {
  const s = ParcelBuilder.Empty(parcel, 1)
  t.ok(s.voxels)
  t.ok(s.features)
  t.end()
})

test('ParcelBuilder#ThreeTowers', (t) => {
  const s = ParcelBuilder.ThreeTowers(parcel, 1)
  t.ok(s.voxels)
  t.ok(s.features)
  t.end()
})

test('ParcelBuilder#Outline', (t) => {
  const s = ParcelBuilder.Outline(parcel, 1)
  t.ok(s.voxels)
  t.ok(s.features)
  t.end()
})

test('ParcelBuilder#House', (t) => {
  const s = ParcelBuilder.House(parcel, 1)
  t.ok(s.voxels)
  t.ok(s.features)
  t.end()
})

test('ParcelBuilder#Pyramid', (t) => {
  const s = ParcelBuilder.Pyramid(parcel, 1)
  t.ok(s.voxels)
  t.ok(s.features)
  t.end()
})

test('ParcelBuilder#Scaffold', (t) => {
  const s = ParcelBuilder.Scaffold(parcel, 1)
  t.ok(s.voxels)
  t.ok(s.features)
  t.end()
})
