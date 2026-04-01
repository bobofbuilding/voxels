const path = require('path')
const { merge } = require('webpack-merge')
const client = require('./webpack-web.config')

module.exports = (env, argv) => {
  return merge(client(env, argv), {
    devServer: {
      server: {
        type: 'https',
        options: {
          key: path.join(__dirname, '/../openssl/cert.key'),
          cert: path.join(__dirname, '/../openssl/cert.pem'),
        },
      },
    },
  })
}
