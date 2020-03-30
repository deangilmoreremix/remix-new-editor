const path = require('path');
const glob = require('glob');
const withSass = require('@zeit/next-sass');

module.exports = withSass({
  exportPathMap() {
    return {
      '/': { page: '/' },
      '/edit': { page: '/edit' },
      '/index': { page: '/index' },
    };
  },
  webpack: (config) => {
    config.module.rules.push(
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader',
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
});
