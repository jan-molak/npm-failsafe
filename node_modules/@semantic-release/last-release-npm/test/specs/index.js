const { defaults } = require('lodash')
const test = require('tap').test

require('../mocks/registry')
const lastRelease = require('../../')

const npm = {
  registry: 'http://registry.npmjs.org/',
  tag: 'latest',
  loglevel: 'error'
}

test('last release from registry', (t) => {
  t.plan(6)

  t.test('get release from package name', (tt) => {
    lastRelease({}, {
      pkg: {name: 'available'},
      npm
    }, (err, release) => {
      tt.error(err)
      tt.is(release.version, '1.33.7', 'version')
      tt.is(release.gitHead, 'HEAD', 'gitHead')
      tt.is(release.tag, 'latest', 'dist-tag')

      tt.end()
    })
  })

  t.test('get release from a tagged package\'s name', (tt) => {
    lastRelease({}, {
      pkg: {name: 'tagged'},
      npm: defaults({tag: 'foo'}, npm)
    }, (err, release) => {
      tt.error(err)
      tt.is(release.version, '0.8.15', 'version')
      tt.is(release.gitHead, 'bar', 'gitHead')
      tt.is(release.tag, 'foo', 'dist-tag')

      tt.end()
    })
  })

  t.test('get release from a fallbackTag', (tt) => {
    lastRelease({}, {
      pkg: {name: 'tagged'},
      options: {
        fallbackTags: {
          bar: 'latest'
        }
      },
      npm: defaults({tag: 'bar'}, npm)
    }, (err, release) => {
      tt.error(err)
      tt.is(release.version, '1.33.7', 'version')
      tt.is(release.gitHead, 'HEAD', 'gitHead')
      tt.is(release.tag, 'bar', 'dist-tag')

      tt.end()
    })
  })

  t.test('get error from an untagged package\'s name', (tt) => {
    lastRelease({}, {
      pkg: {name: 'untagged'},
      npm: defaults({tag: 'bar'}, npm)
    }, (err) => {
      tt.is(err.code, 'ENODISTTAG', 'error')

      tt.end()
    })
  })

  t.test('get release from scoped package name', (tt) => {
    lastRelease({}, {
      pkg: {name: '@scoped/available'},
      npm
    }, (err, release) => {
      tt.error(err)
      tt.is(release.version, '1.33.7', 'version')
      tt.is(release.gitHead, 'HEAD', 'gitHead')
      tt.is(release.tag, 'latest', 'dist-tag')

      tt.end()
    })
  })

  t.test('get nothing from not yet published package name', (tt) => {
    tt.plan(3)

    tt.test('unavailable', (ttt) => {
      lastRelease({}, {
        pkg: {name: 'unavailable'},
        npm
      }, (err, release) => {
        ttt.error(err)
        ttt.is(release.version, undefined, 'no version')
        ttt.end()
      })
    })

    tt.test('unavailable w/o response body', (ttt) => {
      lastRelease({}, {
        pkg: {name: 'unavailable-no-body'},
        npm
      }, (err, release) => {
        ttt.error(err)
        ttt.is(release.version, undefined, 'no version')
        ttt.end()
      })
    })

    tt.test('unavailable w/o status code', (ttt) => {
      lastRelease({retry: {count: 1, factor: 1, minTimeout: 1, maxTimeout: 2}}, {
        pkg: {name: 'unavailable-no-404'},
        npm
      }, (err, release) => {
        ttt.error(err)
        ttt.is(release.version, undefined, 'no version')
        ttt.end()
      })
    })
  })
})
