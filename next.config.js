const path = require('path');
const glob = require('glob');
const withSass = require('@zeit/next-sass');
const withImages = require('next-images');
const withTM = require('next-transpile-modules')([
  '@pqina/pintura',
  '@pqina/react-pintura',
]);

module.exports = withSass({
  exportPathMap() {
    return {
      '/': { page: '/' },
    };
  },
  webpack: (config) => {
    config.module.rules.push(
      {
        test: /\.(jpg|png)$/,
        loader: 'url-loader',
      },
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader',
      },
      {
        test: /\.(otf|ttf|woff|woff2)$/,
        loader: 'url-loader',
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    );
    config.resolve.alias = {
      ...config.resolve.alias,
      styles: './styles',
    };
    return config;
  },
  sassLoaderOptions: {
    sassOptions: {
      includePaths: ['styles', 'node_modules']
        .map(d => path.join(__dirname, d))
        .map(g => glob.sync(g))
        .reduce((a, c) => a.concat(c), []),
    },
  },
  withImages: withImages(),
  withTM:withTM({
    swcMinify: false,
  }),
  compress: false,
});
