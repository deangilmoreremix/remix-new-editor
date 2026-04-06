export default {
  plugins: [
    // eslint-disable-next-line global-require
    require('postcss-easy-import')({ prefix: '_' }), // keep this first
    // eslint-disable-next-line global-require
    require('autoprefixer')({ /* ...options */ }), // so imports are auto-prefixed too
  ],
};
