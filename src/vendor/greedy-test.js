import fill from '../common/voxels/ndarray-fill'

const test = require('tape')
const greedy = require('./greedy')
const ndarray = require('ndarray')

let dims = [6, 6, 6]

test('empty', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => 0)

  let quads = greedy(v)
  t.equal(quads.length, 0, 'has 0 quads')
  t.end()
})

test('full', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => 1)

  let quads = greedy(v)
  t.equal(quads.length, 6, 'has 6 quads')
  t.end()
})

test('random', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => Math.random() > 0.5)

  let quads = greedy(v)
  t.ok(quads.length > 10 * 6, 'count random boxes (may fail)')
  t.end()
})

test('center block', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => (x == 3 && y == 3 && z == 3) ? 1 : 0)

  let quads = greedy(v)
  t.equal(quads.length, 6, 'has 6 quads')
  t.end()
})

test('one block', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => (x == 0 && y == 0 && z == 0) ? 1 : 0)

  let quads = greedy(v)
  t.equal(quads.length, 6, 'has 6 quads')
  t.end()
})

test('two adjacent blocks', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => (x < 2 && y == 0 && z == 0) ? 1 : 0)

  let quads = greedy(v)
  t.equal(quads.length, 6, 'have 6 quads')
  t.end()
})

test('two center blocks', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => ((x == 3 || x == 4) && y == 3 && z == 3) ? 1 : 0)

  let quads = greedy(v)
  t.equal(quads.length, 6, 'have 6 quads')
  t.end()
})

test('stairs blocks', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => (x == 0 && y == 0 && z == 0) ? 1 : 0)

  v.set(1, 1, 0, 1)

  let quads = greedy(v)
  t.equal(quads.length, 12, 'have 12 quads')
  t.end()
})

test('two different blocks', t => {
  let v = ndarray(new Uint16Array(dims[0] * dims[1] * dims[2]), dims)

  fill(v, (x, y, z) => (x == 0 && y == 0 && z == 0) ? 1 : 0)
  v.set(1, 0, 0, 2)

  // Cull hidden faces
  let quads = greedy(v)
  t.equal(quads.length, 10, 'has 10 quads')
  t.end()
})


// test('two adjacent', t => {
//   fill(v, (x, y, z) => (x == 0 && y == 0 && z == 0) ? 1 : 0)

//   let quads = greedy(v)
//   t.equal(quads.length, 3)
//   t.end()
// })

