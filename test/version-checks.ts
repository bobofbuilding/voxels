import * as test from 'tape'
import { deprecated } from '../common/version'

test('version deprecated', (t) => {
  t.test('compare two semver', (t) => {
    const largerSemver = '2.0.0'
    const smallerSemver = '1.9.99'

    const result = deprecated(smallerSemver, largerSemver)

    t.ok(result)
    t.end()
  })
  t.test('compare semver check and build num release', (t) => {
    const semver = '2.0.0'
    const buildNum = '1'

    const result = deprecated(semver, buildNum)

    t.ok(result)
    t.end()
  })
  t.test('compare build num check and semver release', (t) => {
    const semver = '2.0.0'
    const buildNum = '1'

    const result = deprecated(buildNum, semver)

    t.false(result)
    t.end()
  })
  t.test('compare two build nums', (t) => {
    const buildNumSmall = '1'
    const buildNumLarge = '2'

    const result = deprecated(buildNumSmall, buildNumLarge)

    t.ok(result)
    t.end()
  })
})
