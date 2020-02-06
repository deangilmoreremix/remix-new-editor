/* eslint-disable global-require */
/**
 * Created by Eugene Butusov on 18/09/2017.
 */

const throng = require('throng');
require('newrelic');

const WORKERS = process.env.WEB_CONCURRENCY || 1;

throng({
  workers: WORKERS,
  lifetime: Infinity,
  master: () => console.log('Loading app...'),
  start: () => require('./server.js'),
});
