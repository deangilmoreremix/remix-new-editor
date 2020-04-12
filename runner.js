/* eslint-disable global-require */
/**
 * Created by Eugene Butusov on 18/09/2017.
 */
const throng = require('throng');
const config = require('./config/config');


// eslint-disable-next-line no-unused-vars
let newrelic;
if (config.newRelic.enabled) {
  newrelic = require('newrelic');
} else {
  newrelic = {
    getBrowserTimingHeader() {
      return '<!-- New Relic RUM disabled -->';
    },
  };
}
// require('newrelic');

const WORKERS = process.env.WEB_CONCURRENCY || 1;

throng({
  workers: WORKERS,
  lifetime: Infinity,
  master: () => console.log('Loading app...'),
  start: () => require('./server.js'),
});
