import * as test from 'tape'
import * as path from 'path'
import { ParcelVersionValidator } from '../../src/helpers/parcel-version-validator'
import * as fs from 'fs'

test('validate version', (t) => {
  const parcel = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcela.json'), 'utf-8')
  const pi = new ParcelVersionValidator(JSON.parse(parcel))
  const version = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcela_version.json'), 'utf-8')
  t.plan(1)

  const actual = pi.validate(version)
  t.same(actual.parcel_id, 3792)
})

test('validate version with wrong parcel ID', (t) => {
  const parcel = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcela.json'), 'utf-8')
  const parcelJSON = JSON.parse(parcel)
  parcelJSON.id = 1111
  const pi = new ParcelVersionValidator(parcelJSON)

  const version = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcela_version.json'), 'utf-8')
  t.plan(1)

  t.throws(() => pi.validate(version), /parcel ids doesn't match/, 'throws error on wrong parcel id')
})

test('validate version without parcel ID', (t) => {
  const parcel = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcela.json'), 'utf-8')
  const parcelJSON = JSON.parse(parcel)
  delete parcelJSON.id
  const pi = new ParcelVersionValidator(parcelJSON)

  const version = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcelb_version.json'), 'utf-8')
  t.plan(1)

  t.throws(() => pi.validate(version), /parcel ids doesn't match/)
})

test('validate bad shape', (t) => {
  const parcel = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcela.json'), 'utf-8')
  const parcelJSON = JSON.parse(parcel)
  const pi = new ParcelVersionValidator(parcelJSON)

  const version = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcel_a_wrong_shape.json'), 'utf-8')
  t.plan(1)

  // bad shape doesnt matter, it will get stuffed within bounds
  t.doesNotThrow(() => pi.validate(version))
})

test('validate bad voxel data ', (t) => {
  const parcel = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcela.json'), 'utf-8')
  const parcelJSON = JSON.parse(parcel)
  const pi = new ParcelVersionValidator(parcelJSON)

  const version = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcel_a_bad_voxels.json'), 'utf-8')
  t.plan(1)

  t.throws(() => pi.validate(version), /voxel data isn't parsable/)
})

test('nerf naughty features ', (t) => {
  const parcel = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcela.json'), 'utf-8')
  const parcelJSON = JSON.parse(parcel)
  const pi = new ParcelVersionValidator(parcelJSON)

  const version = fs.readFileSync(path.join(__dirname, 'fixtures', 'parcel_a_bad_features.json'), 'utf-8')
  t.plan(3)

  const actual = pi.validate(version)
  // there should now only be one feature inside
  t.notEquals(actual, version)
  t.assert(actual.content.features)
  t.equal(actual.content.features?.length, 1)
  t.equal(actual.content.features![0].id, 'at_edge')

  t.end()
})
