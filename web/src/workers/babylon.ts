// eslint-disable-next-line @typescript-eslint/no-var-requires
const { UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS } = require('../../../vendor/library/urls')
if ('function' === typeof importScripts) {
  importScripts(UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS)
}
