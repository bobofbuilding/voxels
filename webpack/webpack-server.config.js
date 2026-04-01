const path = require('path')
const nodeExternals = require('webpack-node-externals')
const webpack = require('webpack')
const webpackCommon = require('./webpack-common.config')
const { merge } = require('webpack-merge')

module.exports = (env, argv) => {
  return merge(webpackCommon(env, argv), {
    devtool: 'source-map',
    name: 'server',
    entry: {
      boot: { import: './server/boot.ts' },
    },
    target: 'async-node18',
    externalsPresets: { node: true },
    externals: [nodeExternals()],
    node: {
      __dirname: false,
    },
    optimization: {
      minimize: false,
    },
    cache: false,
    module: {
      rules: [
        {
          test: /\.([cm]?ts|tsx)$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                // Skip type checking in development but enable it for production
                // so that the build fails if types are wrong
                transpileOnly: argv.mode !== 'production',
                configFile: argv.mode !== 'production' ? 'tsconfig.json' : 'tsconfig.prod.json',
              },
            },
            {
              loader: 'ifdef-loader',
              options: { RUNTIME: '' },
            },
          ],
          // The server can depend on web/ (for server-side rendering) but not the client
          exclude: [path.resolve(__dirname, '../node_modules'), path.resolve(__dirname, '../src')],
        },
        {
          test: /\.sql/,
          type: 'asset/source',
        },
      ],
    },
    output: {
      filename: 'bundle_server.js',
      path: path.resolve(__dirname, '..', 'server'),
    },
  })
}
