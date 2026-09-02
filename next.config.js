import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import withSass from '@zeit/next-sass';
import withImages from 'next-images';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default withSass({
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
  compress: false,
});
