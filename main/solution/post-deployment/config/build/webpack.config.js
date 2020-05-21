const slsw = require('serverless-webpack');
const CopyPlugin = require('copy-webpack-plugin'); // see https://github.com/boazdejong/webpack-plugin-copy

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
    // slsw.lib.webpack.isLocal && nodeExternals(), // Do NOT uncomment this line
  ], // .filter(x => !!x),
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
