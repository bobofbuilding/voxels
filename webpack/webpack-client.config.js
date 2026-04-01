const DEFAULT_BUILD_NUM = '69420'
const path = require('path')
const webpack = require('webpack')
const webpackCommon = require('./webpack-common.config')
const { merge } = require('webpack-merge')
const CircularDependencyPlugin = require('circular-dependency-plugin')
const CompressionPlugin = require('compression-webpack-plugin')
const zlib = require('zlib')

const opts = {
  RUNTIME: 'WEB',
}

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production'
  const BUILD_NUMBER = process.env.BUILD_NUM || DEFAULT_BUILD_NUM

  return merge(webpackCommon(env, argv), {
    name: 'client',
    devServer: {
      hot: false,
      liveReload: true,
      port: 9100,
    },
    // marking these as externals means that webpack won't try to bundle them if they're imported accidentally
    externals: {
      babylonjs: 'babylonjs',
      '@msgpack/msgpack': 'MessagePack',
    },
    node: {
      global: true,
    },
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
                transpileOnly: !isProduction,
                configFile: argv.mode !== 'production' ? 'tsconfig.json' : 'tsconfig.prod.json',
              },
            },
            {
              loader: 'ifdef-loader',
              options: opts,
            },
          ],

          // The client can depend on web/ (for shared components) but not the server
          exclude: [path.resolve(__dirname, '../node_modules'), path.resolve(__dirname, '../server')],
        },

        // strip comments out of the shaders
        {
          test: /\.(vsh|fsh|fx)$/,
          use: {
            loader: 'strip-json-comments-loader',
          },
        },
      ],
    },
    resolve: {
      fallback: {
        stream: require.resolve('stream-browserify'),
        https: require.resolve('https-browserify'),
        http: require.resolve('stream-http'),
        os: require.resolve('os-browserify'),
        process: 'process/browser',
        querystring: require.resolve('querystring-es3'),
        path: require.resolve('path-browserify'),
        crypto: false,
        vm: false,
      },
      alias: {
        // Ensure ESM fully specified imports like 'process/browser' resolve with an explicit file
        'process/browser': require.resolve('process/browser'),
      },
      // Improve ESM module resolution
      fullySpecified: false,
    },
    output: {
      filename: `${BUILD_NUMBER}-client.js`,
      path: path.resolve(__dirname, '../dist'),
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: require.resolve('process/browser'),
        Buffer: ['buffer', 'Buffer'],
      }),
      isProduction &&
        new CircularDependencyPlugin({
          exclude: /node_modules/,
          failOnError: true,
          allowAsyncCycles: true,
          cwd: process.cwd(),
        }),
      isProduction &&
        new CompressionPlugin({
          filename: '[path][base].gz',
          algorithm: 'gzip',
          test: /\.js$|\.css$|\.html$/,
          threshold: 1024, // the same as the express middleware default
          minRatio: 0.8,
        }),
      isProduction &&
        new CompressionPlugin({
          filename: '[path][base].br',
          algorithm: 'brotliCompress',
          test: /\.(js|css|html|svg)$/,
          compressionOptions: {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            },
          },
          threshold: 8192,
          minRatio: 0.8,
        }),
    ].filter((x) => x),
  })
}
