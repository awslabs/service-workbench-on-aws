/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const CopyPlugin = require('copy-webpack-plugin'); // see https://github.com/boazdejong/webpack-plugin-copy
const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');

const plugins = [new CopyPlugin([])];

module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
  devtool: 'nosources-source-map',
  externals: [
    /aws-sdk/, // Available on AWS Lambda
    slsw.lib.webpack.isLocal && nodeExternals(),
  ].filter((x) => !!x),
  plugins,
  node: {
    __dirname: false,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: { node: '10' }, // Node version on AWS Lambda
                  modules: 'commonjs',
                },
              ],
            ],
            plugins: ['source-map-support'],
          },
        },
      },
      {
        test: /\.ya?ml$/,
        use: 'js-yaml-loader',
      },
    ],
  },
};
