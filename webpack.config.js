var path = require('path');
module.exports = {
  entry: ['./src/js/main.js'],
  output: {
    publicPath: 'build/',
    path: path.join(__dirname, "build"),
    filename: 'bundle.js'
  },
  module: {
    loaders: [
        { test: /\.js$/,
          loader: 'babel-loader' },
        { test: /\.js$/,
          loader: 'strict' }
      ]
  }
};
